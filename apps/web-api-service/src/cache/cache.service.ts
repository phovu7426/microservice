import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

const KEY_PREFIX = 'gateway:';

export interface GetOrSetOptions<T> {
  ttlSeconds?: number;
  /**
   * Return false to skip caching the produced value (e.g. when the factory
   * returned an empty fallback because the upstream was down — caching that
   * would poison the cache for the full TTL).
   */
  shouldCache?: (value: T) => boolean;
}

@Injectable()
export class GatewayCacheService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(GatewayCacheService.name);
  private client: Redis | null = null;
  /**
   * In-process single-flight map. Multiple concurrent requests for the same
   * key share one upstream factory invocation rather than fanning out N
   * times when the cache is cold.
   */
  private readonly inflight = new Map<string, Promise<unknown>>();

  constructor(private readonly config: ConfigService) {}

  async onModuleInit() {
    const url = this.config.get<string>('gateway.redisUrl', '');
    if (!url) {
      this.logger.warn('REDIS_URL not set — caching disabled');
      return;
    }
    try {
      this.client = new Redis(url, {
        lazyConnect: true,
        maxRetriesPerRequest: 3,
        enableOfflineQueue: false,
      });
      this.client.on('error', (err) => {
        this.logger.warn(`Gateway Redis error: ${err.message}`);
      });
      await this.client.connect();
      this.logger.log(`Gateway Redis connected to ${url}`);
    } catch (err: any) {
      this.logger.warn(`Gateway Redis connection failed: ${(err as Error).message} — caching disabled`);
      this.client = null;
    }
  }

  async onModuleDestroy() {
    await this.client?.quit().catch(() => null);
  }

  async get<T>(key: string): Promise<T | null> {
    if (!this.client) return null;
    try {
      const raw = await this.client.get(`${KEY_PREFIX}${key}`);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  }

  async set(key: string, value: unknown, ttlSeconds = 120): Promise<void> {
    if (!this.client) return;
    try {
      await this.client.setex(`${KEY_PREFIX}${key}`, ttlSeconds, JSON.stringify(value));
    } catch {
      // non-critical
    }
  }

  async del(key: string): Promise<void> {
    if (!this.client) return;
    await this.client.del(`${KEY_PREFIX}${key}`).catch(() => null);
  }

  /**
   * Cache-aside read with single-flight + caller-controlled cache predicate.
   *
   * - If multiple concurrent callers ask for the same cold key, they share
   *   one factory invocation (no N-way fan-out to upstream).
   * - If `shouldCache(value)` returns false, the value is returned but NOT
   *   persisted — used by clients that fall back to `[]` / `null` on
   *   upstream failure to avoid poisoning the cache for the full TTL.
   */
  async getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    optionsOrTtl: GetOrSetOptions<T> | number = 120,
  ): Promise<T> {
    const opts: GetOrSetOptions<T> =
      typeof optionsOrTtl === 'number' ? { ttlSeconds: optionsOrTtl } : optionsOrTtl;
    const ttlSeconds = opts.ttlSeconds ?? 120;
    const shouldCache = opts.shouldCache ?? (() => true);

    const cached = await this.get<T>(key);
    if (cached !== null) return cached;

    const existing = this.inflight.get(key);
    if (existing) return existing as Promise<T>;

    const promise = (async () => {
      try {
        const value = await factory();
        if (shouldCache(value)) {
          await this.set(key, value, ttlSeconds);
        }
        return value;
      } finally {
        this.inflight.delete(key);
      }
    })();
    this.inflight.set(key, promise);
    return promise;
  }

  get isEnabled(): boolean {
    return this.client !== null;
  }
}
