import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { EVENT_PRODUCER } from '@package/common';
import { KafkaClientModule, KafkaProducerService } from '@package/kafka-client';
import { IamOutboxCronService } from './services/outbox-relay.service';
import { RbacEventPublisher } from './services/rbac-event-publisher.service';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    KafkaClientModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        clientId: config.get<string>('kafka.clientId', 'iam-service'),
        brokers: config.get<string[]>('kafka.brokers', ['localhost:9093']),
        enabled: config.get<boolean>('kafka.enabled'),
        ssl: config.get('kafka.ssl'),
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [
    IamOutboxCronService,
    RbacEventPublisher,
    { provide: EVENT_PRODUCER, useExisting: KafkaProducerService },
  ],
  exports: [RbacEventPublisher, EVENT_PRODUCER],
})
export class KafkaModule {}
