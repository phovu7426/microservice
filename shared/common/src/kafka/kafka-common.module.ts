import { Global, Module } from '@nestjs/common';
import { RedisModule } from '@package/redis';
import { IdempotencyService } from './idempotency.service';
import { OutboxRelayService, EVENT_PRODUCER } from './outbox-relay.service';

/**
 * Bundle of shared Kafka helpers that need NestJS DI to work:
 *   - IdempotencyService → cross-replica Redis NX claims
 *   - OutboxRelayService → cron-driven outbox publisher
 *
 * Marked @Global so a single import in AppModule makes these injectable
 * across every other module in the service. Without this wrapper they were
 * bare @Injectable() classes exported from `@package/common` — Nest can't
 * resolve them at runtime even though the type imports compile fine.
 *
 * Services that use Kafka should also import their KafkaModule which
 * provides the EVENT_PRODUCER token (backed by KafkaProducerService).
 *
 * Usage:
 *   imports: [..., CommonKafkaModule]
 */
@Global()
@Module({
  imports: [RedisModule],
  providers: [
    IdempotencyService,
    OutboxRelayService,
    // Default null provider — overridden by service-level KafkaModule
    // that provides the real KafkaProducerService via this token.
    { provide: EVENT_PRODUCER, useValue: null },
  ],
  exports: [IdempotencyService, OutboxRelayService, EVENT_PRODUCER],
})
export class CommonKafkaModule {}
