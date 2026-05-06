import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { KAFKA_PRODUCER } from '@package/common';
import { KafkaClientModule, KafkaProducerService } from '@package/kafka-client';
import { OutboxCronService } from './services/outbox-relay.service';

@Module({
  imports: [
    KafkaClientModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        clientId: config.get<string>('kafka.clientId', 'marketing-service'),
        brokers: config.get<string[]>('kafka.brokers', ['localhost:9093']),
        enabled: config.get<boolean>('kafka.enabled'),
        ssl: config.get('kafka.ssl'),
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [
    OutboxCronService,
    { provide: KAFKA_PRODUCER, useExisting: KafkaProducerService },
  ],
  exports: [KAFKA_PRODUCER],
})
export class KafkaModule {}
