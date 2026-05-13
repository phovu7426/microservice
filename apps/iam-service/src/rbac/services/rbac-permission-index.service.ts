import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { RedisService } from '@package/redis';
import { RbacRepository } from '../repositories/rbac.repository';
import { PERM } from '../constants/rbac.constants';

type PermissionNode = { code: string; parentCode: string | null };

@Injectable()
export class RbacPermissionIndexService implements OnModuleInit, OnModuleDestroy {
  private permissionByCode = new Map<string, PermissionNode>();
  private lastPermFetchMs = 0;
  private readonly permIndexTtlMs = 24 * 60 * 60 * 1000;
  private readonly prewarmIntervalMs = 6 * 60 * 60 * 1000;
  private readonly permIndexRefreshChannel = 'rbac:perm_index_refresh';
  private permissionIndexRefreshInFlight: Promise<void> | null = null;
  private prewarmTimer: NodeJS.Timeout | null = null;
  // Persisted reference to the subscriber callback so onModuleDestroy can
  // detach it via redis.unsubscribe(). Without this, the closure retains
  // `this` and prevents GC of the IAM service during hot-reload.
  private subscriberCallback: ((message: string) => void) | null = null;

  constructor(
    private readonly rbacRepo: RbacRepository,
    private readonly redis: RedisService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.ensurePermissionIndexes().catch(() => undefined);
    if (this.redis.isEnabled()) {
      this.subscriberCallback = (_message) => {
        void this.refreshNow().catch(() => undefined);
      };
      await this.redis.subscribe(this.permIndexRefreshChannel, this.subscriberCallback);
    }
    this.prewarmTimer = setInterval(() => {
      void this.ensurePermissionIndexes().catch(() => undefined);
    }, this.prewarmIntervalMs);
    // Don't keep the event loop alive solely for the prewarm timer.
    this.prewarmTimer.unref?.();
  }

  /** Publish a permission-index refresh — call after creating/updating/deleting permissions or roles. */
  async publishRefresh(): Promise<void> {
    await this.refreshNow();
    if (this.redis.isEnabled()) {
      await this.redis
        .publish(this.permIndexRefreshChannel, JSON.stringify({ at: Date.now() }))
        .catch(() => undefined);
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.prewarmTimer) {
      clearInterval(this.prewarmTimer);
      this.prewarmTimer = null;
    }
    if (this.subscriberCallback) {
      // Detach so the closure doesn't pin `this` past module destruction.
      await this.redis
        .unsubscribe(this.permIndexRefreshChannel, this.subscriberCallback)
        .catch(() => undefined);
      this.subscriberCallback = null;
    }
  }

  async prepare(): Promise<void> {
    await this.ensurePermissionIndexes();
  }

  async refreshNow(): Promise<void> {
    this.lastPermFetchMs = 0;
    await this.ensurePermissionIndexes(true);
  }

  matchesAssigned(assignedCodes: Set<string>, need: string): boolean {
    return this.grants(need, (code) => assignedCodes.has(code));
  }

  hasAnyRequiredFromAssigned(assignedCodes: Set<string>, required: string[]): boolean {
    return required.some((need) => this.matchesAssigned(assignedCodes, need));
  }

  private async ensurePermissionIndexes(force = false): Promise<void> {
    if (
      !force &&
      this.permissionByCode.size > 0 &&
      Date.now() - this.lastPermFetchMs <= this.permIndexTtlMs
    )
      return;

    if (this.permissionIndexRefreshInFlight) {
      await this.permissionIndexRefreshInFlight;
      return;
    }

    this.permissionIndexRefreshInFlight = (async () => {
      const byCode = new Map<string, PermissionNode>();
      const nodes = await this.rbacRepo.findPermissions();
      const byId = new Map<string, { code: string; parentId: string | null }>();
      for (const n of nodes) {
        byId.set(String(n.id), {
          code: n.code,
          parentId: n.parentId != null ? String(n.parentId) : null,
        });
      }
      for (const n of nodes) {
        const parent = n.parentId != null ? byId.get(String(n.parentId)) : null;
        if (n.code) byCode.set(n.code, { code: n.code, parentCode: parent?.code ?? null });
      }
      this.permissionByCode = byCode;
      this.lastPermFetchMs = Date.now();
    })();

    try {
      await this.permissionIndexRefreshInFlight;
    } finally {
      this.permissionIndexRefreshInFlight = null;
    }
  }

  private grants(need: string, has: (code: string) => boolean): boolean {
    if (has(PERM.SYSTEM.MANAGE)) return true;
    if (has(need)) return true;
    const visited = new Set<string>();
    for (let cur = this.permissionByCode.get(need); cur?.parentCode; ) {
      if (visited.has(cur.parentCode)) break;
      visited.add(cur.parentCode);
      const parent = this.permissionByCode.get(cur.parentCode);
      if (!parent) break;
      if (parent.code && has(parent.code)) return true;
      cur = parent;
    }
    return false;
  }
}
