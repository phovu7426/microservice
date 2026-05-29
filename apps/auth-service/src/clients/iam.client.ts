import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCircuitBreaker } from '@package/circuit-breaker';
import { RedisService } from '@package/redis';
import { RbacVersionTracker } from '@package/common';
import type { CircuitBreakerPolicy } from 'cockatiel';

const IAM_TIMEOUT_MS = 5_000;
const RBAC_CACHE_TTL_S = 60;

@Injectable()
export class IamClient implements OnModuleInit {
  private readonly baseUrl: string;
  private readonly internalSecret: string;
  private breaker!: CircuitBreakerPolicy;
  private readonly versionTracker: RbacVersionTracker;

  constructor(
    private readonly config: ConfigService,
    private readonly redis: RedisService,
  ) {
    this.baseUrl = config.get<string>('IAM_INTERNAL_URL', '');
    this.internalSecret =
      config.get<string>('INTERNAL_API_SECRET') ||
      config.get<string>('app.internalApiSecret') ||
      '';
    this.versionTracker = new RbacVersionTracker(this.redis);
  }

  onModuleInit() {
    this.breaker = createCircuitBreaker({
      halfOpenAfterMs: 10_000,
      maxConsecutiveFailures: 5,
    });
    this.breaker.onBreak(() => {});
  }

  /** Returns true if IAM_INTERNAL_URL is configured */
  isConfigured(): boolean {
    return !!this.baseUrl;
  }

  private async buildCacheKey(userId: string, permissions: string[]): Promise<string> {
    const v = await this.versionTracker.get();
    return `rbac:client:v${v}:${userId}:${permissions.slice().sort().join(',')}`;
  }

  /**
   * Check if user has all required permissions.
   * Uses Redis cache (60s TTL, versioned via rbac:meta.version) →
   * circuit breaker → IAM HTTP call. getOrSet de-duplicates concurrent
   * misses for the same (user, perms) within this process.
   */
  async checkPermissions(userId: string, permissions: string[]): Promise<boolean> {
    const cacheKey = await this.buildCacheKey(userId, permissions);

    const fetchAndCheck = async (): Promise<{ allowed: boolean }> => {
      const data = await this.doPost(`${this.baseUrl}/internal/rbac/check`, {
        userId,
        permissions,
      });
      return { allowed: data?.allowed === true };
    };

    try {
      if (this.redis.isEnabled()) {
        const result = await this.redis.getOrSet<{ allowed: boolean }>(
          cacheKey,
          fetchAndCheck,
          RBAC_CACHE_TTL_S,
        );
        return result.allowed;
      }
    } catch { /* Redis unavailable — fall through */ }

    const fallback = await fetchAndCheck();
    return fallback.allowed;
  }

  private async doGet(url: string): Promise<any> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), IAM_TIMEOUT_MS);

    try {
      return await this.breaker.execute(async () => {
        const headers: Record<string, string> = {};
        if (this.internalSecret) headers['x-internal-secret'] = this.internalSecret;

        const res = await fetch(url, {
          method: 'GET',
          headers,
          signal: controller.signal,
        });

        if (!res.ok) throw new Error(`IAM returned ${res.status}`);

        const json = await res.json();
        return json?.data ?? json;
      });
    } finally {
      clearTimeout(timer);
    }
  }

  private async doPost(url: string, body: Record<string, unknown>): Promise<any> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), IAM_TIMEOUT_MS);

    try {
      return await this.breaker.execute(async () => {
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        };
        if (this.internalSecret) headers['x-internal-secret'] = this.internalSecret;

        const res = await fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
          signal: controller.signal,
        });

        if (!res.ok) {
          if (res.status >= 500) throw new Error(`IAM returned ${res.status}`);
          return { allowed: false };
        }

        const json = await res.json();
        return json?.data ?? json;
      });
    } catch (err: any) {
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }
}
