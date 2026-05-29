import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '@package/redis';

export interface AttemptLimiterOverrides {
  maxAttempts?: number;
  lockoutSeconds?: number;
  windowSeconds?: number;
}

/**
 * Fail-closed brute-force / abuse limiter. When Redis is reachable but throws,
 * we treat the request as locked (fail-closed) so a Redis outage cannot be
 * exploited as a brute-force bypass. Redis being intentionally disabled
 * (no REDIS_URL) is allowed only outside production via env validation.
 */
@Injectable()
export class AttemptLimiterService {
  private readonly logger = new Logger(AttemptLimiterService.name);
  private readonly defaultMaxAttempts: number;
  private readonly defaultLockoutSeconds: number;
  private readonly defaultWindowSeconds: number;

  constructor(
    private readonly redis: RedisService,
    private readonly configService: ConfigService,
  ) {
    this.defaultMaxAttempts = Number(
      this.configService.get<number>('SECURITY_ATTEMPT_MAX', 5),
    );
    this.defaultLockoutSeconds = Number(
      this.configService.get<number>('SECURITY_ATTEMPT_LOCKOUT_SECONDS', 1800),
    );
    this.defaultWindowSeconds = Number(
      this.configService.get<number>('SECURITY_ATTEMPT_WINDOW_SECONDS', 900),
    );
  }

  async check(
    scope: string,
    identifier: string,
  ): Promise<{ isLocked: boolean; remainingMinutes?: number }> {
    if (!this.redis.isEnabled()) return { isLocked: false };
    const key = `${scope}:${identifier}`;
    let data: string | null;
    try {
      data = await this.redis.get(key);
    } catch (err: any) {
      this.logger.error(`AttemptLimiter check failed for ${scope}; failing closed`, err as Error);
      throw new ServiceUnavailableException('Security service unavailable');
    }
    if (!data) return { isLocked: false };
    let info: { attempts?: number; lockedUntil?: number };
    try {
      info = JSON.parse(data);
    } catch {
      // Corrupt entry — discard and treat as not locked
      await this.redis.del(key).catch(() => undefined);
      return { isLocked: false };
    }
    const now = Math.floor(Date.now() / 1000);
    if (info.lockedUntil && info.lockedUntil > now) {
      const remaining = Math.ceil((info.lockedUntil - now) / 60);
      return { isLocked: true, remainingMinutes: remaining };
    }
    if (info.lockedUntil && info.lockedUntil <= now) {
      await this.redis.del(key).catch(() => undefined);
    }
    return { isLocked: false };
  }

  async add(
    scope: string,
    identifier: string,
    overrides?: AttemptLimiterOverrides,
  ): Promise<void> {
    if (!this.redis.isEnabled()) return;
    const key = `${scope}:${identifier}`;
    let data: string | null;
    try {
      data = await this.redis.get(key);
    } catch (err: any) {
      this.logger.error(`AttemptLimiter add failed for ${scope}`, err as Error);
      throw new ServiceUnavailableException('Security service unavailable');
    }
    const now = Math.floor(Date.now() / 1000);
    let attempts = 0;
    let lockedUntil = 0;
    if (data) {
      try {
        const info = JSON.parse(data) as { attempts?: number; lockedUntil?: number };
        if (info.lockedUntil && info.lockedUntil > now) return;
        attempts = info.attempts || 0;
      } catch {
        attempts = 0;
      }
    }
    const maxAttempts = overrides?.maxAttempts ?? this.defaultMaxAttempts;
    const lockoutSeconds = overrides?.lockoutSeconds ?? this.defaultLockoutSeconds;
    const windowSeconds = overrides?.windowSeconds ?? this.defaultWindowSeconds;
    attempts += 1;
    const isLocked = attempts >= maxAttempts;
    if (isLocked) lockedUntil = now + lockoutSeconds;
    const ttl = isLocked ? lockoutSeconds : windowSeconds;
    try {
      await this.redis.set(key, JSON.stringify({ attempts, lockedUntil }), ttl);
    } catch (err: any) {
      this.logger.error(`AttemptLimiter set failed for ${scope}`, err as Error);
      throw new ServiceUnavailableException('Security service unavailable');
    }
  }

  async reset(scope: string, identifier: string): Promise<void> {
    if (!this.redis.isEnabled()) return;
    try {
      await this.redis.del(`${scope}:${identifier}`);
    } catch (err: any) {
      this.logger.warn(`AttemptLimiter reset failed for ${scope}: ${(err as Error).message}`);
    }
  }
}
