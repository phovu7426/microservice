import { Injectable, Inject, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { KafkaJS } from '@confluentinc/kafka-javascript';
import { KafkaClientOptions } from './kafka-client.module';
import { createKafkaInstance } from './kafka-factory';

type Producer = KafkaJS.Producer;

@Injectable()
export class KafkaProducerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(KafkaProducerService.name);
  private kafka: InstanceType<typeof KafkaJS.Kafka>;
  private producer: Producer;

  private readonly MAX_RETRIES = 3;
  private readonly RETRY_BASE_MS = 200;

  private readonly enabled: boolean;
  private readonly producerOptions: Pick<KafkaClientOptions, 'lingerMs' | 'batchSize' | 'compression'>;
  private connected = false;

  constructor(
    @Inject('KAFKA_OPTIONS') options: KafkaClientOptions,
  ) {
    this.enabled = options.enabled ?? true;
    this.producerOptions = {
      lingerMs: options.lingerMs,
      batchSize: options.batchSize,
      compression: options.compression,
    };
    this.kafka = createKafkaInstance(options);
    this.producer = this.kafka.producer(); // placeholder, overridden in onModuleInit
  }

  async onModuleInit() {
    if (!this.enabled) return;
    const producerConfig: any = {};
    if (this.producerOptions.lingerMs !== undefined) {
      producerConfig['queue.buffering.max.ms'] = this.producerOptions.lingerMs;
    }
    if (this.producerOptions.batchSize !== undefined) {
      producerConfig['batch.size'] = this.producerOptions.batchSize;
    }
    if (this.producerOptions.compression) {
      producerConfig['compression.codec'] = this.producerOptions.compression;
    }

    this.producer = Object.keys(producerConfig).length > 0
      ? this.kafka.producer(producerConfig)
      : this.kafka.producer();

    await this.producer.connect();
    this.connected = true;
  }

  async onModuleDestroy() {
    if (!this.enabled) return;
    this.connected = false;
    await this.producer.disconnect();
  }

  /**
   * Publish a message to a Kafka topic with retry and error handling.
   * Retries up to MAX_RETRIES times with exponential backoff.
   */
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
          messages: [
            {
              key: key || undefined,
              value,
            },
          ],
        });
        return; // success
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

  /**
   * Low-level send that mirrors the KafkaJS producer.send() signature.
   * Use this when you need full control over messages (e.g. custom headers/keys).
   */
  async send(record: { topic: string; messages: Array<{ key?: string; value: string; headers?: Record<string, string> }> }): Promise<void> {
    let lastError: Error | undefined;
    for (let attempt = 0; attempt <= this.MAX_RETRIES; attempt++) {
      try {
        await this.producer.send(record);
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

  /**
   * Lightweight health check — verifies the producer connected successfully.
   */
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
