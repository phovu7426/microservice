import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  Optional,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { CircuitBreakerPolicy } from 'cockatiel';
import { I18nContext } from 'nestjs-i18n';
import { createCircuitBreaker } from '@package/circuit-breaker';
import { RedisService } from '@package/redis';
import { PERMS_KEY } from '../decorators/permission.decorator';
import { RbacVersionTracker } from '../rbac/rbac-version-tracker';
import { commonMsg } from '../i18n/common-messages';

const RBAC_TIMEOUT_MS = 5_000;
const RBAC_GUARD_CACHE_TTL_S = 60;

/**
 * Bounded staleness window after IAM bumps `rbac:meta.version`:
 *   - up to RBAC_VERSION_TTL_MS (2s) before this guard refreshes its
 *     local version → new cache keys
 *   - up to RBAC_GUARD_CACHE_TTL_S (60s) before old keys expire
 *   - worst case ~62s where a revoked permission can still pass an
 *     allow-cache hit in flight. Acceptable for admin endpoints; tune
 *     RBAC_GUARD_CACHE_TTL_S down if you need tighter UX.
 */
@Injectable()
export class RbacGuard implements CanActivate {
  private readonly logger = new Logger(RbacGuard.name);
  private readonly breaker: CircuitBreakerPolicy;
  private readonly versionTracker: RbacVersionTracker;

  constructor(
    private readonly reflector: Reflector,
    private readonly config: ConfigService,
    @Optional() @Inject(RedisService) private readonly redis?: RedisService,
  ) {
    this.versionTracker = new RbacVersionTracker(this.redis);
    this.breaker = createCircuitBreaker({
      halfOpenAfterMs: 10_000,
      maxConsecutiveFailures: 5,
    });

    this.breaker.onBreak(() => {
      this.logger.warn('RBAC circuit opened — IAM service unavailable');
    });
  }

  private async buildCacheKey(userId: string): Promise<string> {
    const v = await this.versionTracker.get();
    // One entry per user (not per perm-tuple). 100 admin endpoints × 5
    // distinct perm tuples now share 1 cache entry per user instead of
    // 500 — and a single fetch covers every endpoint they hit.
    return `rbac:guard:v${v}:u:${userId}`;
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const permissions = this.reflector.getAllAndOverride<string[]>(PERMS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]) ?? [];

    if (!permissions.length) return true;
    if (permissions.includes('public') || permissions.includes('internal')) return true;

    const lang = I18nContext.current()?.lang ?? 'vi';
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    if (!user?.sub) throw new UnauthorizedException(commonMsg(lang, 'AUTHENTICATION_REQUIRED'));

    // @Authenticated() — JWT da verify boi JwtGuard, khong can goi IAM.
    if (permissions.includes('authenticated')) return true;

    const iamUrl = this.config.get<string>('IAM_INTERNAL_URL');
    if (!iamUrl) {
      const env = this.config.get<string>('NODE_ENV') ?? process.env.NODE_ENV;
      // Bypass only in explicit local development. Staging/test/unset must fail closed.
      if (env !== 'development') {
        throw new ForbiddenException(commonMsg(lang, 'PERMISSION_SERVICE_NOT_CONFIGURED'));
      }
      return true;
    }

    const userId = String(user.sub);
    const cacheKey = await this.buildCacheKey(userId);

    const secret =
      this.config.get<string>('INTERNAL_API_SECRET') ||
      this.config.get<string>('app.internalApiSecret') ||
      '';

    // Fetch the user's full effective permission set (after hierarchy
    // expansion) and cache it per user. Subsequent guards on the same
    // user re-use this entry — no second HTTP call regardless of the
    // route's @Permission(...) tuple. getOrSet dedups concurrent misses.
    let effective: string[];
    try {
      const fetchEffective = async () => this.breaker.execute(async () => {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), RBAC_TIMEOUT_MS);
        let res: Response;
        try {
          res = await fetch(
            `${iamUrl}/internal/rbac/effective?userId=${encodeURIComponent(userId)}`,
            {
              method: 'GET',
              headers: { 'x-internal-secret': secret },
              signal: controller.signal,
            },
          );
        } finally {
          clearTimeout(timer);
        }

        if (!res.ok) {
          if (res.status >= 500) throw new Error(`IAM returned ${res.status}`);
          // 4xx → no permissions resolved (treated as deny).
          return [] as string[];
        }
        const body = (await res.json()) as { permissions?: string[]; data?: { permissions?: string[] } };
        const perms = body?.data?.permissions ?? body?.permissions;
        return Array.isArray(perms) ? perms : [];
      });

      if (this.redis?.isEnabled()) {
        effective = await this.redis.getOrSet<string[]>(
          cacheKey,
          fetchEffective,
          RBAC_GUARD_CACHE_TTL_S,
        );
      } else {
        effective = await fetchEffective();
      }
    } catch (err) {
      this.logger.error(`RBAC check failed: ${(err as Error).message}`);
      throw new ForbiddenException(commonMsg(lang, 'PERMISSION_CHECK_UNAVAILABLE'));
    }

    // Allow if ANY required permission is present in the effective set.
    // Hierarchy expansion happened IAM-side, so a simple membership test
    // is correct here.
    const set = new Set(effective);
    const allowed = permissions.some((p) => set.has(p));
    if (!allowed) throw new ForbiddenException(commonMsg(lang, 'PERMISSION_DENIED'));
    return true;
  }
}
