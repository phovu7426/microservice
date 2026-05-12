import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis | null = null;
  private subscriberClient: Redis | null = null;
  private readonly channelCallbacks = new Map<string, Array<(message: string) => void>>();
  private readonly inflightMap = new Map<string, Promise<any>>();
  private enabled = false;

  constructor(private readonly config: ConfigService) {}

  private getRedisUrl(): string | undefined {
    return this.config.get<string>('redis.url') || this.config.get<string>('REDIS_URL');
  }

  private createClient(url: string): Redis {
    return new Redis(url, {
      lazyConnect: true,
      enableOfflineQueue: true,
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => Math.min(times * 200, 5_000),
      connectTimeout: 10_000,
      reconnectOnError: (err) => {
        const targetErrors = ['READONLY', 'ECONNRESET', 'ETIMEDOUT'];
        return targetErrors.some((t) => err.message.includes(t));
      },
    });
  }

  async onModuleInit(): Promise<void> {
    const url = this.getRedisUrl();
    if (!url) {
      this.logger.warn('REDIS_URL not set — Redis disabled');
      return;
    }
    try {
      this.client = this.createClient(url);
      this.client.on('error', (err) => {
        this.logger.error('Redis connection error', err);
      });
      this.client.on('connect', () => {
        this.logger.log('Redis connected');
      });
      this.client.on('reconnecting', (delay: number) => {
        this.logger.warn(`Redis reconnecting in ${delay}ms`);
      });
      await this.client.connect();
      this.enabled = true;
    } catch (err) {
      this.logger.error('Redis connect failed', err as Error);
      this.client = null;
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.client?.quit().catch((err) => {
      this.logger.warn(`Redis client quit error: ${(err as Error).message}`);
    });
    await this.subscriberClient?.quit().catch((err) => {
      this.logger.warn(`Redis subscriber quit error: ${(err as Error).message}`);
    });
    this.client = null;
    this.subscriberClient = null;
  }

  isEnabled(): boolean {
    return this.enabled && this.client !== null;
  }

  async ping(): Promise<void> {
    if (!this.client) throw new Error('Redis client not connected');
    await this.client.ping();
  }

  async get(key: string): Promise<string | null> {
    if (!this.client) return null;
    return this.client.get(key);
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (!this.client) return;
    if (ttlSeconds) {
      await this.client.set(key, value, 'EX', ttlSeconds);
    } else {
      await this.client.set(key, value);
    }
  }

  async del(key: string): Promise<void> {
    if (!this.client) return;
    await this.client.del(key);
  }

  async exists(key: string): Promise<boolean> {
    if (!this.client) return false;
    return (await this.client.exists(key)) > 0;
  }

  async hincrby(key: string, field: string, increment: number): Promise<number> {
    if (!this.client) return 0;
    return this.client.hincrby(key, field, increment);
  }

  async hgetall(key: string): Promise<Record<string, string>> {
    if (!this.client) return {};
    return (await this.client.hgetall(key)) || {};
  }

  async hdel(key: string, ...fields: string[]): Promise<void> {
    if (!this.client) return;
    await this.client.hdel(key, ...fields);
  }

  async hget(key: string, field: string): Promise<string | null> {
    if (!this.client) return null;
    return this.client.hget(key, field);
  }

  async hset(key: string, field: string, value: string): Promise<void> {
    if (!this.client) return;
    await this.client.hset(key, field, value);
  }

  async setnx(key: string, value: string, ttlSeconds?: number): Promise<boolean> {
    if (!this.client) return false;
    const result = ttlSeconds
      ? await this.client.set(key, value, 'EX', ttlSeconds, 'NX')
      : await this.client.set(key, value, 'NX');
    return result === 'OK';
  }

  async expire(key: string, seconds: number): Promise<void> {
    if (!this.client) return;
    await this.client.expire(key, seconds);
  }

  async ttl(key: string): Promise<number> {
    if (!this.client) return -1;
    return this.client.ttl(key);
  }

  async keys(pattern: string): Promise<string[]> {
    if (!this.client) return [];
    const results: string[] = [];
    let cursor = '0';
    do {
      const [nextCursor, keys] = await this.client.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = nextCursor;
      results.push(...keys);
    } while (cursor !== '0');
    return results;
  }

  async incr(key: string): Promise<number> {
    if (!this.client) return 0;
    return this.client.incr(key);
  }

  async sadd(key: string, ...members: string[]): Promise<number> {
    if (!this.client) return 0;
    return this.client.sadd(key, ...members);
  }

  async smembers(key: string): Promise<string[]> {
    if (!this.client) return [];
    return this.client.smembers(key);
  }

  async srem(key: string, ...members: string[]): Promise<number> {
    if (!this.client) return 0;
    return this.client.srem(key, ...members);
  }

  async getdel(key: string): Promise<string | null> {
    if (!this.client) return null;
    return (this.client as any).getdel
      ? (this.client as any).getdel(key)
      : this.client.call('GETDEL', key) as Promise<string | null>;
  }

  async multi(commands: Array<[string, ...(string | number)[]]>): Promise<unknown[]> {
    if (!this.client) return [];
    let pipeline = this.client.multi();
    for (const [cmd, ...args] of commands) {
      pipeline = (pipeline as any)[cmd.toLowerCase()](...args);
    }
    const result = await pipeline.exec();
    if (!result) return [];
    return result.map(([err, val]) => {
      if (err) throw err;
      return val;
    });
  }

  async flushDb(): Promise<void> {
    if (!this.client) return;
    await this.client.flushdb();
  }

  async deleteMany(keys: string[]): Promise<void> {
    if (!this.client || !keys.length) return;
    await this.client.del(...keys);
  }

  async pfadd(key: string, ...elements: string[]): Promise<number> {
    if (!this.client) return 0;
    return this.client.pfadd(key, ...elements);
  }

  async rename(source: string, destination: string): Promise<void> {
    if (!this.client) return;
    await this.client.rename(source, destination);
  }

  async publish(channel: string, message: string): Promise<void> {
    if (!this.client) return;
    await this.client.publish(channel, message);
  }

  async subscribe(channel: string, callback: (message: string) => void): Promise<void> {
    const url = this.getRedisUrl();
    if (!url) return;
    const callbacks = this.channelCallbacks.get(channel) || [];
    callbacks.push(callback);
    this.channelCallbacks.set(channel, callbacks);
    try {
      if (!this.subscriberClient) {
        this.subscriberClient = this.createClient(url);
        await this.subscriberClient.connect();
        this.subscriberClient.on('message', (ch: string, msg: string) => {
          (this.channelCallbacks.get(ch) || []).forEach((cb) => cb(msg));
        });
      }
      await this.subscriberClient.subscribe(channel);
    } catch {
      // ignore subscriber failure
    }
  }

  async unsubscribe(channel: string, callback?: (message: string) => void): Promise<void> {
    const callbacks = this.channelCallbacks.get(channel);
    if (!callbacks?.length) return;
    if (callback) {
      const idx = callbacks.indexOf(callback);
      if (idx >= 0) callbacks.splice(idx, 1);
    } else {
      callbacks.length = 0;
    }
    if (!callbacks.length) {
      this.channelCallbacks.delete(channel);
      try {
        await this.subscriberClient?.unsubscribe(channel);
      } catch {
        // best-effort cleanup
      }
    }
  }

  async acquireLock(key: string, token: string, ttlSeconds: number): Promise<boolean> {
    if (!this.client) return false;
    const result = await this.client.set(key, token, 'EX', ttlSeconds, 'NX');
    return result === 'OK';
  }

  async releaseLock(key: string, token: string): Promise<boolean> {
    if (!this.client) return false;
    const script = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;
    const result = await this.client.eval(script, 1, key, token) as number;
    return result === 1;
  }

  async getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    ttlSeconds: number,
  ): Promise<T> {
    try {
      if (this.client) {
        const raw = await this.client.get(key);
        if (raw) return JSON.parse(raw) as T;
      }
    } catch {}

    const existing = this.inflightMap.get(key);
    if (existing) return existing as Promise<T>;

    if (this.inflightMap.size >= 1000) {
      // Evict oldest 25% instead of clearing all — prevents thundering herd
      const evictCount = 250;
      const keys = this.inflightMap.keys();
      for (let i = 0; i < evictCount; i++) {
        const next = keys.next();
        if (next.done) break;
        this.inflightMap.delete(next.value);
      }
    }

    const promise = factory().then(async (result) => {
      try {
        if (this.client) {
          await this.client.set(
            key,
            JSON.stringify(result, (_, v) => (typeof v === 'bigint' ? String(v) : v)),
            'EX',
            ttlSeconds,
          );
        }
      } catch {}
      return result;
    }).finally(() => {
      this.inflightMap.delete(key);
    });

    this.inflightMap.set(key, promise);
    return promise;
  }

  async getOrSetWithLock<T>(
    key: string,
    factory: () => Promise<T>,
    ttlSeconds: number,
    lockTtlSeconds = 10,
  ): Promise<T> {
    // 1. Try cache first
    try {
      if (this.client) {
        const raw = await this.client.get(key);
        if (raw) return JSON.parse(raw) as T;
      }
    } catch {}

    // 2. Try to acquire distributed lock
    const lockKey = `lock:${key}`;
    const token = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const acquired = await this.acquireLock(lockKey, token, lockTtlSeconds);

    if (!acquired) {
      // Another instance is loading — wait briefly then try cache again
      await new Promise<void>((resolve) => setTimeout(resolve, 50));
      try {
        if (this.client) {
          const raw = await this.client.get(key);
          if (raw) return JSON.parse(raw) as T;
        }
      } catch {}
      // If still no cache (lock holder failed), fall through to fetch
    }

    // 3. Fetch from source and populate cache
    try {
      const result = await factory();
      try {
        if (this.client) {
          await this.client.set(
            key,
            JSON.stringify(result, (_, v) => (typeof v === 'bigint' ? String(v) : v)),
            'EX',
            ttlSeconds,
          );
        }
      } catch {}
      return result;
    } finally {
      if (acquired) await this.releaseLock(lockKey, token);
    }
  }
}
