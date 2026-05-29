import { RedisService } from '@package/redis';

const RBAC_VERSION_KEY = 'rbac:meta';
const RBAC_VERSION_FIELD = 'version';
const DEFAULT_TTL_MS = 2_000;

/**
 * Tracks the global RBAC cache version published by IAM.
 *
 * IAM bumps `rbac:meta.version` whenever permissions, roles, or
 * user-role assignments change. Each guard / client embeds this
 * version into its own cache key so a bump implicitly invalidates
 * every entry without a Redis SCAN.
 *
 * Used by both `RbacGuard` (shared, every microservice) and
 * `IamClient` (auth-service local cache) to keep the polling logic
 * in one place.
 */
export class RbacVersionTracker {
  private version = 1;
  private versionLastFetch = 0;

  constructor(
    private readonly redis: RedisService | undefined,
    private readonly ttlMs: number = DEFAULT_TTL_MS,
  ) {}

  /**
   * Returns the current version, refreshing from Redis at most once
   * per `ttlMs` window. On Redis failure the last known version is
   * returned and `versionLastFetch` is NOT advanced, so the next call
   * retries immediately instead of caching a stale value.
   */
  async get(): Promise<number> {
    if (!this.redis?.isEnabled()) return this.version;
    if (Date.now() - this.versionLastFetch < this.ttlMs) return this.version;
    try {
      const meta = await this.redis.hgetall(RBAC_VERSION_KEY);
      const parsed = Number(meta?.[RBAC_VERSION_FIELD] || 1);
      this.version = Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
      this.versionLastFetch = Date.now();
    } catch {
      // Keep last known version; do NOT advance versionLastFetch so the
      // next request retries rather than caching the stale state.
    }
    return this.version;
  }
}
