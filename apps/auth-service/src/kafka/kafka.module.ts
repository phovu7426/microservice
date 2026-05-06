import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { KAFKA_PRODUCER } from '@package/common';
import { KafkaClientModule, KafkaProducerService } from '@package/kafka-client';
import { AuthOutboxCronService } from './services/outbox-relay.service';
import { MailPublisher } from './services/mail-publisher.service';

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
  ],
  exports: [MailPublisher, KAFKA_PRODUCER],
})
export class KafkaModule {}
