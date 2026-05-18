import { Injectable, Logger } from '@nestjs/common';
import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';

const EXCHANGE = 'events';

@Injectable()
export class RabbitmqProducerService {
  private readonly logger = new Logger(RabbitmqProducerService.name);

  constructor(private readonly amqp: AmqpConnection) {}

  async send(record: {
    topic: string;
    messages: Array<{ key?: string; value: string; headers?: Record<string, string> }>;
  }): Promise<void> {
    for (const msg of record.messages) {
      let content: unknown;
      try {
        content = JSON.parse(msg.value);
      } catch (err) {
        this.logger.error(`Failed to parse message for routing key "${record.topic}"`);
        throw err;
      }
      await this.amqp.publish(EXCHANGE, record.topic, content, {
        headers: msg.headers,
        persistent: true,
      });
    }
  }
}
