import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EVENT_PRODUCER } from '@package/common';
import { RabbitmqClientModule, RabbitmqProducerService } from '@package/rabbitmq-client';
import { OutboxCronService } from '../services/outbox-relay.service';

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
    OutboxCronService,
    { provide: EVENT_PRODUCER, useExisting: RabbitmqProducerService },
  ],
  exports: [EVENT_PRODUCER],
})
export class RabbitmqModule {}
