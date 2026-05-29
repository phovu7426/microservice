import { Module, DynamicModule } from '@nestjs/common';
import { RedisProducerService } from './redis-producer.service';

export interface RedisClientOptions {
  url: string;
  enabled?: boolean;
  streamMaxLen?: number;
  groupName?: string;
  consumerName?: string;
  blockMs?: number;
}

export interface RedisClientAsyncOptions {
  imports?: any[];
  useFactory: (...args: any[]) => RedisClientOptions | Promise<RedisClientOptions>;
  inject?: any[];
}

@Module({})
export class RedisClientModule {
  static register(options: RedisClientOptions): DynamicModule {
    return {
      module: RedisClientModule,
      providers: [
        { provide: 'REDIS_CLIENT_OPTIONS', useValue: options },
        RedisProducerService,
      ],
      exports: [RedisProducerService],
      global: true,
    };
  }

  static registerAsync(options: RedisClientAsyncOptions): DynamicModule {
    return {
      module: RedisClientModule,
      imports: options.imports || [],
      providers: [
        {
          provide: 'REDIS_CLIENT_OPTIONS',
          useFactory: options.useFactory,
          inject: options.inject || [],
        },
        RedisProducerService,
      ],
      exports: [RedisProducerService],
      global: true,
    };
  }
}
