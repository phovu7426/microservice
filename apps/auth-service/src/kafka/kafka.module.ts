import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { KAFKA_PRODUCER } from '@package/common';
import { KafkaClientModule, KafkaProducerService } from '@package/kafka-client';
import { AuthOutboxCronService } from './services/outbox-relay.service';
import { MailPublisher } from './services/mail-publisher.service';
import { GroupMemberAddedHandler } from './handlers/group-member-added.handler';
import { GroupMemberRemovedHandler } from './handlers/group-member-removed.handler';
import { GroupDeletedHandler } from './handlers/group-deleted.handler';
import { KafkaConsumerService } from './services/kafka-consumer.service';

@Module({
  imports: [
    KafkaClientModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        clientId: config.get<string>('kafka.clientId', 'auth-service'),
        brokers: config.get<string[]>('kafka.brokers', ['localhost:9093']),
        enabled: config.get<boolean>('kafka.enabled'),
        ssl: config.get('kafka.ssl'),
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [
    AuthOutboxCronService,
    MailPublisher,
    { provide: KAFKA_PRODUCER, useExisting: KafkaProducerService },
    GroupMemberAddedHandler,
    GroupMemberRemovedHandler,
    GroupDeletedHandler,
    KafkaConsumerService,
  ],
  exports: [MailPublisher, KAFKA_PRODUCER],
})
export class KafkaModule {}
