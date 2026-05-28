import { Injectable, Logger, Optional, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IdempotencyService } from './idempotency.service';

export interface OutboxRelayOptions {
  tableName: string;
  topicMap: Record<string, string>;
  /** Unique prefix for the leader lock key (e.g. service name).
   *  Prevents different services from blocking each other's relay. */
  lockPrefix?: string;
}

/**
 * Interface for the Kafka producer dependency.
 * Matches the `send()` method on KafkaProducerService from @package/kafka-client.
 */
export interface IKafkaProducer {
  send(record: { topic: string; messages: Array<{ key?: string; value: string; headers?: Record<string, string> }> }): Promise<void>;
}

export const EVENT_PRODUCER = 'EVENT_PRODUCER';

// Allowlist of outbox table names. Add new entries here when a new service
// wires up outbox publishing. We use $queryRawUnsafe with the table name
// interpolated into the SQL — this allowlist is the only thing standing
// between a stray refactor and a SQL-injection vector.
// Maps DB table name → Prisma model property name.
// Raw SQL uses the DB name; Prisma Client uses the model property.
const ALLOWED_TABLES: Record<string, string> = {
  'outbox': 'outbox',
};

@Injectable()
export class OutboxRelayService {
  private readonly logger = new Logger(OutboxRelayService.name);
  private prisma: any;
  private shuttingDown = false;
  private kafkaProducer: IKafkaProducer | null = null;
  private lockPrefix = '';

  constructor(
    private readonly config: ConfigService,
    private readonly idempotency: IdempotencyService,
    @Optional() @Inject(EVENT_PRODUCER) kafkaProducer?: IKafkaProducer,
  ) {
    this.kafkaProducer = kafkaProducer ?? null;
  }

  /**
   * Initialize with Prisma instance and options.
   * Call this in onModuleInit of the consuming module.
   */
  init(prisma: any, options: OutboxRelayOptions) {
    this.prisma = prisma;
    if (options.lockPrefix) this.lockPrefix = options.lockPrefix;
  }

  /**
   * Wire the event producer at runtime.
   * CommonKafkaModule provides EVENT_PRODUCER=null as a placeholder.
   * Each service's KafkaModule/RabbitmqModule provides the real producer,
   * but OutboxRelayService (a global singleton) cannot see it at construction.
   * Call this from the cron service's onModuleInit, which runs inside the
   * correct module scope and can inject the real EVENT_PRODUCER.
   */
  setProducer(producer: IKafkaProducer): void {
    this.kafkaProducer = producer;
  }

  isEnabled(): boolean {
    return this.kafkaProducer !== null;
  }

  /**
   * Atomically claim a batch of unpublished outbox rows and publish them.
   *
   * Uses `FOR UPDATE SKIP LOCKED` so multiple replicas / cron ticks each
   * grab a distinct slice. Two-phase approach:
   *   1. SELECT ... FOR UPDATE SKIP LOCKED → lock rows
   *   2. UPDATE set claimed_at (not published) → release lock at COMMIT
   *   3. Publish to Kafka OUTSIDE transaction
   *   4. Mark published=true AFTER Kafka confirms
   *   5. On failure, release claim so future relay ticks can retry
   */
  async relay(tableName: string, topicMap: Record<string, string>) {
    if (this.shuttingDown) return;
    if (!this.kafkaProducer || !this.prisma) return;

    if (!(tableName in ALLOWED_TABLES)) {
      this.logger.error(`Refusing to relay from unknown table "${tableName}" — not in allowlist`);
      return;
    }

    const lockName = this.lockPrefix
      ? `outbox-relay:${this.lockPrefix}:${tableName}`
      : `outbox-relay:${tableName}`;
    const acquired = await this.idempotency.tryLeaderLock(lockName, 45);
    if (!acquired) return;

    let claimed: any[] = [];
    try {
      claimed = await this.prisma.$transaction(async (tx: any) => {
        const rows: any[] = await tx.$queryRawUnsafe(
          `SELECT id, event_type, payload
             FROM "${tableName}"
            WHERE published = false
            ORDER BY created_at ASC
            LIMIT 100
              FOR UPDATE SKIP LOCKED`,
        );
        if (!rows.length) return [];
        return rows;
      });
    } catch (err) {
      this.logger.error('Outbox relay claim failed', err);
      return;
    }

    if (!claimed.length) return;

    const publishedIds: bigint[] = [];

    // Group claimable events by topic so we can batch-send per topic.
    const topicBatches = new Map<string, Array<{ event: any; eventIdStr: string }>>();

    for (const event of claimed) {
      const topic = topicMap[event.event_type];
      if (!topic) continue;

      const eventIdStr = String(event.id);
      const claim = await this.idempotency.claim(`outbox:${topic}`, eventIdStr);
      if (!claim) {
        this.logger.debug(`Outbox event ${event.id} → ${topic} already claimed elsewhere`);
        continue;
      }

      if (!topicBatches.has(topic)) topicBatches.set(topic, []);
      topicBatches.get(topic)!.push({ event, eventIdStr });
    }

    // Send one batch per topic instead of one message per event.
    for (const [topic, batch] of topicBatches) {
      try {
        const messages = batch.map(({ event, eventIdStr }) => {
          const payload = event.payload as any;
          const key =
            payload?.comic_id?.toString() ||
            payload?.post_id?.toString() ||
            payload?.user_id?.toString() ||
            eventIdStr;
          return {
            key,
            value: JSON.stringify(event.payload),
            headers: { 'event-id': eventIdStr },
          };
        });

        await this.kafkaProducer!.send({ topic, messages });

        // Kafka confirmed — mark all events in this batch as published
        for (const { event } of batch) {
          publishedIds.push(event.id);
        }
      } catch (err) {
        // Release claims for all events in the failed batch so future relay ticks can retry.
        for (const { eventIdStr } of batch) {
          await this.idempotency.release(`outbox:${topic}`, eventIdStr);
        }
        this.logger.error(
          `Failed to publish batch of ${batch.length} events to ${topic} — claims released for retry`,
          err,
        );
      }
    }

    // Batch-mark all successfully published events
    if (publishedIds.length > 0) {
      try {
        const modelName = ALLOWED_TABLES[tableName];
        await this.prisma[modelName].updateMany({
          where: { id: { in: publishedIds } },
          data: { published: true },
        });
      } catch (err) {
        // Events were already sent to Kafka — next relay tick will try to
        // mark them again. Kafka consumers must be idempotent regardless.
        this.logger.error('Failed to mark outbox events as published', err);
      }
    }
  }
}
