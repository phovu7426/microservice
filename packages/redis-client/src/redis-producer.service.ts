import { Injectable, Inject, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import { RedisClientOptions } from './redis-client.module';

@Injectable()
export class RedisProducerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisProducerService.name);
  private readonly client: Redis;
  private readonly enabled: boolean;
  private readonly maxLen: number;
  private connected = false;
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_BASE_MS = 200;

  constructor(@Inject('REDIS_CLIENT_OPTIONS') options: RedisClientOptions) {
    this.enabled = options.enabled ?? true;
    this.maxLen = options.streamMaxLen ?? 10_000;
    this.client = new Redis(options.url, {
      lazyConnect: true,
      enableOfflineQueue: true,
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => Math.min(times * 200, 5_000),
      connectTimeout: 10_000,
    });
  }

  async onModuleInit(): Promise<void> {
    if (!this.enabled) return;
    this.client.on('error', (err) => this.logger.error('Redis producer error', err));
    this.client.on('connect', () => this.logger.log('Redis producer connected'));
    await this.client.connect();
    this.connected = true;
  }

  async onModuleDestroy(): Promise<void> {
    if (!this.enabled) return;
    this.connected = false;
    await this.client.quit().catch((err) =>
      this.logger.warn(`Redis producer quit error: ${(err as Error).message}`),
    );
  }

  async send(record: {
    topic: string;
    messages: Array<{ key?: string; value: string; headers?: Record<string, string> }>;
  }): Promise<void> {
    if (!this.enabled) return;
    let lastError: Error | undefined;
    for (let attempt = 0; attempt <= this.MAX_RETRIES; attempt++) {
      try {
        for (const msg of record.messages) {
          await (this.client as any).xadd(
            `events:${record.topic}`,
            'MAXLEN', '~', String(this.maxLen),
            '*',
            'key',     msg.key ?? '',
            'value',   msg.value,
            'headers', msg.headers ? JSON.stringify(msg.headers) : '{}',
          );
        }
        return;
      } catch (err: any) {
        lastError = err as Error;
        if (attempt < this.MAX_RETRIES) {
          const delay = this.RETRY_BASE_MS * Math.pow(2, attempt);
          this.logger.warn(
            `Redis send to "${record.topic}" failed (attempt ${attempt + 1}/${this.MAX_RETRIES + 1}), retrying in ${delay}ms: ${lastError.message}`,
          );
          await this.sleep(delay);
        }
      }
    }
    const finalError = lastError ?? new Error(`Redis send to "${record.topic}" failed`);
    this.logger.error(
      `Redis send to "${record.topic}" failed after ${this.MAX_RETRIES + 1} attempts: ${finalError.message}`,
    );
    throw finalError;
  }

  async emit(topic: string, payload: any, key?: string): Promise<void> {
    const value = JSON.stringify(payload);
    await this.send({ topic, messages: [{ key, value }] });
  }

  async ping(): Promise<void> {
    if (!this.enabled) return;
    if (!this.connected) throw new Error('Redis producer is not connected');
    await this.client.ping();
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
