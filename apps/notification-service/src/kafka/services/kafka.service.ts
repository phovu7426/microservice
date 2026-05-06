import { Injectable, OnModuleInit, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { KafkaJS } from '@confluentinc/kafka-javascript';
import { IdempotencyService } from '@package/common';
import { FileLogger } from '@package/bootstrap';

type Consumer = KafkaJS.Consumer;
type EachMessagePayload = KafkaJS.EachMessagePayload;
type Producer = KafkaJS.Producer;
import { KafkaHandler } from '../handlers/kafka-handler.interface';
import { ChapterPublishedHandler } from '../handlers/chapter-published.handler';
import { CommentCreatedHandler } from '../handlers/comment-created.handler';
import { UserFollowedHandler } from '../handlers/user-followed.handler';
import { UserUnfollowedHandler } from '../handlers/user-unfollowed.handler';
import { UserRegisteredHandler } from '../handlers/user-registered.handler';
import { PasswordResetHandler } from '../handlers/password-reset.handler';
import { ContactSubmittedHandler } from '../handlers/contact-submitted.handler';
import { PostCommentCreatedHandler } from '../handlers/post-comment-created.handler';
import { MailSendHandler } from '../handlers/mail-send.handler';

const MAX_PAYLOAD_BYTES = 256 * 1024;
const DEDUP_LRU_SIZE = 5_000;

/** Tiny in-memory LRU for at-least-once dedup. */
class LruSet {
  private readonly set = new Set<string>();
  constructor(private readonly capacity: number) {}
  has(key: string): boolean {
    return this.set.has(key);
  }
  add(key: string): void {
    if (this.set.has(key)) {
      this.set.delete(key);
      this.set.add(key);
      return;
    }
    if (this.set.size >= this.capacity) {
      const oldest = this.set.values().next().value;
      if (oldest !== undefined) this.set.delete(oldest);
    }
    this.set.add(key);
  }
}

const MAX_HANDLER_ATTEMPTS = 5;
const DLQ_TOPIC_SUFFIX = '.dlq';

@Injectable()
export class KafkaService implements OnModuleInit, OnApplicationShutdown {
  private consumer: Consumer | null = null;
  private dlqProducer: Producer | null = null;
  private handlers!: Map<string, KafkaHandler>;
  private readonly seen = new LruSet(DEDUP_LRU_SIZE);
  private readonly attempts = new Map<string, number>();
  private inFlight = 0;
  private shuttingDown = false;

  constructor(
    private readonly config: ConfigService,
    private readonly idempotency: IdempotencyService,
    private readonly fileLogger: FileLogger,
    private readonly chapterPublished: ChapterPublishedHandler,
    private readonly commentCreated: CommentCreatedHandler,
    private readonly userFollowed: UserFollowedHandler,
    private readonly userUnfollowed: UserUnfollowedHandler,
    private readonly userRegistered: UserRegisteredHandler,
    private readonly passwordReset: PasswordResetHandler,
    private readonly contactSubmitted: ContactSubmittedHandler,
    private readonly postCommentCreated: PostCommentCreatedHandler,
    private readonly mailSend: MailSendHandler,
  ) {}

  async onModuleInit() {
    this.handlers = new Map<string, KafkaHandler>([
      ['comic.chapter.published', this.chapterPublished],
      ['comic.comment.created', this.commentCreated],
      ['user.followed.comic', this.userFollowed],
      ['user.unfollowed.comic', this.userUnfollowed],
      ['user.registered', this.userRegistered],
      ['user.password.reset', this.passwordReset],
      ['contact.submitted', this.contactSubmitted],
      ['post.comment.created', this.postCommentCreated],
      ['mail.send', this.mailSend],
    ]);

    const brokers = this.config.get<string[]>('kafka.brokers');
    const groupId = this.config.get<string>('kafka.groupId');
    if (!brokers?.length) return;

    const kafka = new KafkaJS.Kafka({
      kafkaJS: {
        clientId: 'notification-service',
        brokers,
        retry: { retries: 8, initialRetryTime: 300, maxRetryTime: 30_000 },
      },
    });
    this.consumer = kafka.consumer({
      kafkaJS: {
        groupId: groupId || 'notification-service',
        sessionTimeout: 30_000,
        heartbeatInterval: 3_000,
        fromBeginning: false,
        allowAutoTopicCreation: true,
      },
    });
    await this.consumer!.connect();

    this.dlqProducer = kafka.producer();
    await this.dlqProducer!.connect();

    const admin = kafka.admin();
    await admin.connect();
    const topics = Array.from(this.handlers.keys());
    try {
      await admin.createTopics({ topics: topics.map((t) => ({ topic: t, numPartitions: 1, replicationFactor: 1 })) });
    } catch {
      // Ignore "topic already exists" errors
    }
    await admin.disconnect();

    for (const topic of topics) {
      await this.consumer!.subscribe({ topic });
    }

    await this.consumer!.run({
      partitionsConsumedConcurrently: 3,
      eachMessage: async (payload) => this.dispatch(payload),
    });
  }

  async onApplicationShutdown() {
    this.shuttingDown = true;
    if (!this.consumer) return;
    try { await this.consumer.stop(); } catch { /* swallow */ }

    const drainStart = Date.now();
    while (this.inFlight > 0 && Date.now() - drainStart < 25_000) {
      await new Promise((r) => setTimeout(r, 100));
    }

    try { await this.consumer.disconnect(); } catch { /* swallow */ }
    this.consumer = null;

    if (this.dlqProducer) {
      try { await this.dlqProducer.disconnect(); } catch { /* swallow */ }
      this.dlqProducer = null;
    }
  }

  private async dispatch({ topic, partition, message }: EachMessagePayload): Promise<void> {
    if (this.shuttingDown) return;
    if (!message.value) return;

    const log = this.fileLogger.create(`kafka/${topic}`, {
      topic, partition, offset: message.offset,
    });

    if (message.value.length > MAX_PAYLOAD_BYTES) {
      log.addDebug('skipped oversize message', { size: message.value.length });
      log.save();
      return;
    }

    const dedupKey = `${topic}:${partition}:${message.offset}`;
    if (this.seen.has(dedupKey)) {
      log.addDebug('skipped duplicate (in-memory LRU)');
      log.save();
      return;
    }

    const handler = this.handlers.get(topic);
    if (!handler) return;

    let payload: any;
    try {
      payload = JSON.parse(message.value.toString());
    } catch (err) {
      log.addException(err);
      log.addDebug('skipped malformed JSON');
      log.save();
      return;
    }
    this.seen.add(dedupKey);

    const eventId =
      payload?.id?.toString() ||
      payload?.event_id?.toString() ||
      `${partition}:${message.offset}`;
    const claimed = await this.idempotency.claim(topic, eventId);
    if (!claimed) {
      log.addDebug('skipped duplicate (Redis idempotency)', { eventId });
      log.save();
      return;
    }

    this.inFlight++;
    try {
      log.addDebug('handler started');
      await handler.handle(payload);
      this.attempts.delete(dedupKey);
      log.addDebug('handler succeeded');
      log.save();
    } catch (err) {
      const attempt = (this.attempts.get(dedupKey) ?? 0) + 1;
      this.attempts.set(dedupKey, attempt);
      log.addException(err);
      log.addDebug('handler failed', { attempt, maxAttempts: MAX_HANDLER_ATTEMPTS });

      if (attempt >= MAX_HANDLER_ATTEMPTS) {
        log.addDebug('shipped to DLQ');
        await this.shipToDlq(topic, partition, message, payload, err as Error);
        this.attempts.delete(dedupKey);
        log.save();
        return;
      }

      log.save();
      throw err;
    } finally {
      this.inFlight--;
    }
  }

  private async shipToDlq(
    topic: string,
    partition: number,
    message: EachMessagePayload['message'],
    payload: any,
    err: Error,
  ): Promise<void> {
    const dlqTopic = `${topic}${DLQ_TOPIC_SUFFIX}`;
    if (!this.dlqProducer) return;

    const envelope = {
      original_topic: topic,
      partition,
      offset: message.offset,
      original_key: message.key?.toString(),
      original_payload: payload,
      error: { name: err.name, message: err.message, stack: err.stack },
      failed_at: new Date().toISOString(),
    };
    try {
      await this.dlqProducer.send({
        topic: dlqTopic,
        messages: [{ key: message.key ?? undefined, value: JSON.stringify(envelope) }],
      });
    } catch (dlqErr) {
      const log = this.fileLogger.create('kafka/dlq-failed', {
        topic, dlqTopic, offset: message.offset,
      });
      log.addException(dlqErr);
      log.save();
    }
  }
}
