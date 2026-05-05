import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { KAFKA_PRODUCER } from '@package/common';
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
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [
    IamOutboxCronService,
    RbacEventPublisher,
    { provide: KAFKA_PRODUCER, useExisting: KafkaProducerService },
  ],
  exports: [RbacEventPublisher, KAFKA_PRODUCER],
})
export class KafkaModule {}
