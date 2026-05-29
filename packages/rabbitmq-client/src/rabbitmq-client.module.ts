import { Module, DynamicModule } from '@nestjs/common';
import { RabbitMQModule } from '@golevelup/nestjs-rabbitmq';
import { RabbitmqProducerService } from './rabbitmq-producer.service';

export interface RabbitmqClientOptions {
  uri: string;
  enabled?: boolean;
}

export interface RabbitmqClientAsyncOptions {
  imports?: any[];
  useFactory: (...args: any[]) => RabbitmqClientOptions | Promise<RabbitmqClientOptions>;
  inject?: any[];
}

@Module({})
export class RabbitmqClientModule {
  static registerAsync(options: RabbitmqClientAsyncOptions): DynamicModule {
    return {
      module: RabbitmqClientModule,
      global: true,
      imports: [
        RabbitMQModule.forRootAsync({
          imports: options.imports ?? [],
          useFactory: async (...args: any[]) => {
            const opts = await options.useFactory(...args);
            return {
              uri: opts.uri,
              exchanges: [
                { name: 'events', type: 'topic', options: { durable: true } },
                { name: 'events.dlq', type: 'topic', options: { durable: true } },
              ],
              connectionInitOptions: { wait: false },
              enableControllerDiscovery: true,
            };
          },
          inject: options.inject ?? [],
        }),
      ],
      providers: [RabbitmqProducerService],
      exports: [RabbitmqProducerService, RabbitMQModule],
    };
  }
}
