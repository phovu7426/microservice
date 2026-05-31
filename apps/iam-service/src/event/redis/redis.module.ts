import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EVENT_PRODUCER } from '@package/common';
import { RedisClientModule, RedisProducerService } from '@package/redis-client';
import { IamOutboxCronService } from '../services/outbox-relay.service';
import { RbacEventPublisher } from '../services/rbac-event-publisher.service';

@Module({
  imports: [
    RedisClientModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        url: config.get<string>('REDIS_EVENT_URL', 'redis://localhost:6380'),
        streamMaxLen: config.get<number>('REDIS_STREAM_MAX_LEN', 10_000),
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [
    IamOutboxCronService,
    RbacEventPublisher,
    { provide: EVENT_PRODUCER, useExisting: RedisProducerService },
  ],
  exports: [RbacEventPublisher, EVENT_PRODUCER],
})
export class RedisEventModule {}
