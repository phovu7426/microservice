import { Injectable, Logger } from '@nestjs/common';
import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';

const EXCHANGE = 'events';

@Injectable()
export class RabbitmqProducerService {
  private readonly logger = new Logger(RabbitmqProducerService.name);

  constructor(private readonly amqp: AmqpConnection) {}

  ping(): void {
    // AmqpConnection lifecycle managed by @golevelup/nestjs-rabbitmq
    // If connection fails, the library throws on publish
  }

  isEnabled(): boolean {
    return true;
  }

  async send(record: {
    topic: string;
    messages: Array<{ key?: string; value: string; headers?: Record<string, string> }>;
  }): Promise<void> {
    for (const msg of record.messages) {
      let content: unknown;
      try {
        content = JSON.parse(msg.value);
      } catch (err: any) {
        this.logger.error(`Failed to parse message for routing key "${record.topic}"`, (err as Error).stack);
        throw err;
      }
      await this.amqp.publish(EXCHANGE, record.topic, content, {
        headers: msg.headers,
        persistent: true,
      });
    }
  }
}
