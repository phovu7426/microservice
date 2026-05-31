import { Module, DynamicModule } from '@nestjs/common';
import { KafkaProducerService } from './kafka-producer.service';

export interface KafkaSslOptions {
  rejectUnauthorized: boolean;
  ca: string;
  cert: string;
  key: string;
}

export interface KafkaClientOptions {
  brokers: string[];
  clientId: string;
  enabled?: boolean;
  ssl?: KafkaSslOptions;
  compression?: 'none' | 'gzip' | 'snappy' | 'lz4' | 'zstd';
}

export interface KafkaClientAsyncOptions {
  imports?: any[];
  useFactory: (...args: any[]) => KafkaClientOptions | Promise<KafkaClientOptions>;
  inject?: any[];
}

@Module({})
export class KafkaClientModule {
  static register(options: KafkaClientOptions): DynamicModule {
    return {
      module: KafkaClientModule,
      providers: [
        {
          provide: 'KAFKA_OPTIONS',
          useValue: options,
        },
        KafkaProducerService,
      ],
      exports: [KafkaProducerService],
      global: true,
    };
  }

  static registerAsync(options: KafkaClientAsyncOptions): DynamicModule {
    return {
      module: KafkaClientModule,
      imports: options.imports || [],
      providers: [
        {
          provide: 'KAFKA_OPTIONS',
          useFactory: options.useFactory,
          inject: options.inject || [],
        },
        KafkaProducerService,
      ],
      exports: [KafkaProducerService],
      global: true,
    };
  }
}
