import { Injectable, Inject, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Kafka, Producer, CompressionTypes } from 'kafkajs';
import { KafkaClientOptions } from './kafka-client.module';
import { createKafkaInstance } from './kafka-factory';

const compressionMap: Record<string, CompressionTypes> = {
  none: CompressionTypes.None,
  gzip: CompressionTypes.GZIP,
  snappy: CompressionTypes.Snappy,
  lz4: CompressionTypes.LZ4,
  zstd: CompressionTypes.ZSTD,
};

@Injectable()
export class KafkaProducerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(KafkaProducerService.name);
  private kafka: Kafka;
  private producer: Producer;

  private readonly MAX_RETRIES = 3;
  private readonly RETRY_BASE_MS = 200;

  private readonly enabled: boolean;
  private readonly compressionType: CompressionTypes;
  private connected = false;

  constructor(
    @Inject('KAFKA_OPTIONS') options: KafkaClientOptions,
  ) {
    this.enabled = options.enabled ?? true;
    this.compressionType = options.compression
      ? compressionMap[options.compression]
      : CompressionTypes.None;
    this.kafka = createKafkaInstance(options);
    this.producer = this.kafka.producer();
  }

  async onModuleInit() {
    if (!this.enabled) return;
    this.producer = this.kafka.producer();
    await this.producer.connect();
    this.connected = true;
  }

  async onModuleDestroy() {
    if (!this.enabled) return;
    this.connected = false;
    await this.producer.disconnect();
  }

  async emit(topic: string, payload: any, key?: string): Promise<void> {
    let value: string;
    try {
      value = JSON.stringify(payload);
    } catch (err: any) {
      this.logger.error(
        `Failed to serialize payload for topic "${topic}": ${(err as Error).message}`,
      );
      throw err;
    }

    let lastError: Error | undefined;
    for (let attempt = 0; attempt <= this.MAX_RETRIES; attempt++) {
      try {
        await this.producer.send({
          topic,
          compression: this.compressionType,
          messages: [{ key: key || undefined, value }],
        });
        return;
      } catch (err: any) {
        lastError = err as Error;
        if (attempt < this.MAX_RETRIES) {
          const delay = this.RETRY_BASE_MS * Math.pow(2, attempt);
          this.logger.warn(
            `Kafka emit to "${topic}" failed (attempt ${attempt + 1}/${this.MAX_RETRIES + 1}), retrying in ${delay}ms: ${lastError.message}`,
          );
          await this.sleep(delay);
        }
      }
    }

    this.logger.error(
      `Kafka emit to "${topic}" failed after ${this.MAX_RETRIES + 1} attempts: ${lastError?.message}`,
    );
    throw lastError;
  }

  async send(record: { topic: string; messages: Array<{ key?: string; value: string; headers?: Record<string, string> }> }): Promise<void> {
    let lastError: Error | undefined;
    for (let attempt = 0; attempt <= this.MAX_RETRIES; attempt++) {
      try {
        await this.producer.send({ compression: this.compressionType, ...record });
        return;
      } catch (err: any) {
        lastError = err as Error;
        if (attempt < this.MAX_RETRIES) {
          const delay = this.RETRY_BASE_MS * Math.pow(2, attempt);
          this.logger.warn(
            `Kafka send to "${record.topic}" failed (attempt ${attempt + 1}/${this.MAX_RETRIES + 1}), retrying in ${delay}ms: ${lastError.message}`,
          );
          await this.sleep(delay);
        }
      }
    }

    this.logger.error(
      `Kafka send to "${record.topic}" failed after ${this.MAX_RETRIES + 1} attempts: ${lastError?.message}`,
    );
    throw lastError;
  }

  async ping(): Promise<void> {
    if (!this.enabled) return;
    if (!this.connected) {
      throw new Error('Kafka producer is not connected');
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
