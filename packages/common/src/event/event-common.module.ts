import { Global, Module } from '@nestjs/common';
import { RedisModule } from '@package/redis';
import { IdempotencyService } from './idempotency.service';
import { OutboxRelayService, EVENT_PRODUCER } from './outbox-relay.service';

/**
 * Broker-agnostic event infrastructure shared across all services:
 *   - IdempotencyService → cross-replica Redis NX claims
 *   - OutboxRelayService → cron-driven outbox publisher
 *
 * Marked @Global so a single import in AppModule makes these injectable
 * across every other module in the service.
 *
 * Each service imports its own KafkaModule or RabbitmqModule which provides
 * the real EVENT_PRODUCER token and calls outboxRelay.setProducer() in
 * onModuleInit to wire the producer into the global singleton.
 *
 * Usage:
 *   imports: [..., CommonEventModule]
 */
@Global()
@Module({
  imports: [RedisModule],
  providers: [
    IdempotencyService,
    OutboxRelayService,
    // Null placeholder — real producer set at runtime via setProducer()
    // in each service's KafkaModule/RabbitmqModule cron service.
    { provide: EVENT_PRODUCER, useValue: null },
  ],
  exports: [IdempotencyService, OutboxRelayService, EVENT_PRODUCER],
})
export class CommonEventModule {}
