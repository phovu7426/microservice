import { Injectable, OnModuleInit, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { KafkaJS } from '@confluentinc/kafka-javascript';
import { createKafkaInstance } from '@package/kafka-client';
import { FileLogger } from '@package/bootstrap';
import { KafkaHandler } from '../interfaces/kafka-handler.interface';
import { GroupMemberAddedHandler } from '../handlers/group-member-added.handler';
import { GroupMemberRemovedHandler } from '../handlers/group-member-removed.handler';
import { GroupDeletedHandler } from '../handlers/group-deleted.handler';

type Consumer = KafkaJS.Consumer;
type EachMessagePayload = KafkaJS.EachMessagePayload;

@Injectable()
export class KafkaConsumerService implements OnModuleInit, OnApplicationShutdown {
  private consumer: Consumer | null = null;
  private handlers!: Map<string, KafkaHandler>;
  private inFlight = 0;
  private shuttingDown = false;

  constructor(
    private readonly config: ConfigService,
    private readonly fileLogger: FileLogger,
    private readonly groupMemberAdded: GroupMemberAddedHandler,
    private readonly groupMemberRemoved: GroupMemberRemovedHandler,
    private readonly groupDeleted: GroupDeletedHandler,
  ) {}

  async onModuleInit() {
    this.handlers = new Map<string, KafkaHandler>([
      ['group.member.added', this.groupMemberAdded],
      ['group.member.removed', this.groupMemberRemoved],
      ['group.deleted', this.groupDeleted],
    ]);

    const brokers = this.config.get<string[]>('kafka.brokers');
    if (!brokers?.length) return;

    const ssl = this.config.get<any>('kafka.ssl');
    const kafka = createKafkaInstance({
      clientId: 'auth-service-consumer',
      brokers,
      ssl,
      retry: { retries: 8, initialRetryTime: 300, maxRetryTime: 30_000 },
    });

    this.consumer = kafka.consumer({
      kafkaJS: {
        groupId: this.config.get<string>('kafka.groupId', 'auth-service-group'),
        sessionTimeout: 30_000,
        heartbeatInterval: 3_000,
        fromBeginning: false,
        allowAutoTopicCreation: true,
      },
    });
    await this.consumer.connect();

    for (const topic of this.handlers.keys()) {
      await this.consumer.subscribe({ topic });
    }

    await this.consumer.run({
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
  }

  private async dispatch({ topic, partition, message }: EachMessagePayload): Promise<void> {
    if (this.shuttingDown || !message.value) return;

    if (message.value.length > 256 * 1024) return;

    const handler = this.handlers.get(topic);
    if (!handler) return;

    let payload: any;
    try {
      payload = JSON.parse(message.value.toString());
    } catch {
      return;
    }

    this.inFlight++;
    try {
      await handler.handle(payload);
    } catch (err) {
      const log = this.fileLogger.create(`kafka/${topic}`, { topic, partition, offset: message.offset });
      log.addException(err);
      log.save();
      throw err;
    } finally {
      this.inFlight--;
    }
  }
}
