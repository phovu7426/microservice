import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EVENT_PRODUCER } from '@package/common';
import { RabbitmqClientModule, RabbitmqProducerService } from '@package/rabbitmq-client';
import { PostOutboxCronService } from '../kafka/services/outbox-relay.service';

// OutboxCronService lives in kafka/services/ and is intentionally shared (not duplicated).
// EVENT_PRODUCER token is reused so existing consumers work unchanged with RabbitMQ.
@Module({
  imports: [
    RabbitmqClientModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        uri: config.get<string>('RABBITMQ_URL', 'amqp://localhost:5672'),
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [
    PostOutboxCronService,
    { provide: EVENT_PRODUCER, useExisting: RabbitmqProducerService },
  ],
  exports: [EVENT_PRODUCER],
})
export class RabbitmqModule {}
