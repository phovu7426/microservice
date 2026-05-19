import { Injectable, OnModuleInit, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { KafkaJS } from '@confluentinc/kafka-javascript';
import { createKafkaInstance } from '@package/kafka-client';
import { IdempotencyService, LruSet } from '@package/common';
import { FileLogger } from '@package/bootstrap';

type Consumer = KafkaJS.Consumer;
type EachMessagePayload = KafkaJS.EachMessagePayload;
type Producer = KafkaJS.Producer;
import { KafkaHandler } from '../interfaces/kafka-handler.interface';
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

    const ssl = this.config.get<any>('kafka.ssl');
    const kafka = createKafkaInstance({
      clientId: 'notification-service',
      brokers,
      ssl,
      retry: { retries: 8, initialRetryTime: 300, maxRetryTime: 30_000 },
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
    const replicationFactor = this.config.get<number>('kafka.replicationFactor') ?? 1;
    const topics = Array.from(this.handlers.keys());
    const existingTopics = await admin.listTopics();
    const newTopics = topics.filter((t) => !existingTopics.includes(t));
    if (newTopics.length) {
      try {
        await admin.createTopics({ topics: newTopics.map((t) => ({ topic: t, numPartitions: 1, replicationFactor })) });
      } catch (err) {
        const log = this.fileLogger.create('kafka/create-topics', {});
        log.addException(err);
        log.addDebug('create_topics_failed');
        log.save();
      }
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

    const msgCtx = { topic, partition, offset: message.offset };

    if (message.value.length > MAX_PAYLOAD_BYTES) {
      const log = this.fileLogger.create(`kafka/${topic}`, msgCtx);
      log.addDebug('skipped_oversize', { size: message.value.length });
      log.save();
      return;
    }

    const dedupKey = `${topic}:${partition}:${message.offset}`;
    if (this.seen.has(dedupKey)) {
      const log = this.fileLogger.create(`kafka/${topic}`, msgCtx);
      log.addDebug('skipped_dedup');
      log.save();
      return;
    }

    const handler = this.handlers.get(topic);
    if (!handler) {
      const log = this.fileLogger.create(`kafka/${topic}`, msgCtx);
      log.addDebug('skipped_no_handler');
      log.save();
      return;
    }

    let payload: any;
    try {
      payload = JSON.parse(message.value.toString());
    } catch (err) {
      const log = this.fileLogger.create(`kafka/${topic}`, msgCtx);
      log.addException(err);
      log.addDebug('skipped_malformed_json');
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
      const log = this.fileLogger.create(`kafka/${topic}`, { ...msgCtx, eventId });
      log.addDebug('skipped_idempotent');
      log.save();
      return;
    }

    this.inFlight++;
    const dispatchLog = this.fileLogger.create(`kafka/${topic}`, {
      topic, partition, offset: message.offset, eventId,
    });
    dispatchLog.addDebug('dispatching');
    try {
      await handler.handle(payload);
      dispatchLog.addDebug('handler_ok');
      dispatchLog.save();
      this.attempts.delete(dedupKey);
    } catch (err) {
      const attempt = (this.attempts.get(dedupKey) ?? 0) + 1;
      this.attempts.set(dedupKey, attempt);

      const log = this.fileLogger.create(`kafka/${topic}`, {
        topic, partition, offset: message.offset, eventId, attempt,
      });
      log.addException(err);

      if (attempt >= MAX_HANDLER_ATTEMPTS) {
        log.addDebug('shipped_to_dlq');
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
