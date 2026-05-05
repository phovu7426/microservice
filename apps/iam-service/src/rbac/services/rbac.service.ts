import { ForbiddenException, Injectable } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { t } from '@package/common';
import { RbacCacheService } from './rbac-cache.service';
import { RbacPermissionIndexService } from './rbac-permission-index.service';
import { RbacRoleAssignmentService } from './rbac-role-assignment.service';
import { RbacRepository } from '../repositories/rbac.repository';
import { PERM } from '../constants/rbac.constants';
import { RbacId, NullableRbacId } from '../types';
import { toPrimaryKey } from 'src/types';

function toAssignedSet(codes: Iterable<string>): Set<string> {
  return new Set(
    Array.from(codes).filter((c) => typeof c === 'string' && c.length > 0),
  );
}

@Injectable()
export class RbacService {
  private readonly refreshInFlight = new Map<string, Promise<Set<string>>>();

  constructor(
    private readonly rbacCache: RbacCacheService,
    private readonly permissionIndexService: RbacPermissionIndexService,
    private readonly roleAssignmentService: RbacRoleAssignmentService,
    private readonly rbacRepo: RbacRepository,
    private readonly i18n: I18nService,
  ) {}

  async hasPermissions(
    userId: RbacId,
    groupId: NullableRbacId,
    required: string[],
  ): Promise<boolean> {
    const assigned = await this.getPermissions(userId, groupId);
    return this.permissionIndexService.hasAnyRequiredFromAssigned(assigned, required);
  }

  async getPermissions(userId: RbacId, groupId: NullableRbacId): Promise<Set<string>> {
    const read = await this.rbacCache.getPermissions(userId, groupId);
    if (read.cached) return toAssignedSet(read.codes);
    return this.refreshPermissions(userId, groupId);
  }

  async refreshPermissions(userId: RbacId, groupId: NullableRbacId): Promise<Set<string>> {
    const key = this.scopeKey(userId, groupId);
    const pending = this.refreshInFlight.get(key);
    if (pending) {
      await pending;
      const fromCache = await this.rbacCache.getPermissions(userId, groupId);
      return toAssignedSet(fromCache.codes);
    }

    const refreshPromise = (async () => {
      await this.permissionIndexService.prepare();
      const codes = await this.roleAssignmentService.getActivePermissionCodes(userId, groupId);
      const set = toAssignedSet(codes);
      await this.rbacCache.setPermissions(userId, groupId, Array.from(set));
      return set;
    })();

    this.refreshInFlight.set(key, refreshPromise);
    try {
      return await refreshPromise;
    } finally {
      this.refreshInFlight.delete(key);
    }
  }

  /**
   * Guard against privilege escalation: caller must already hold every
   * permission contained in the role they want to grant. System-only
   * permissions (e.g. `system.manage`) require the caller to hold them too.
   */
  async assertCallerCanGrantRole(
    actorId: RbacId,
    actorGroupId: NullableRbacId,
    roleIds: (string | bigint)[],
  ): Promise<void> {
    if (!roleIds.length) return;
    const targetCodes = await this.rbacRepo.getPermissionCodesForRoles(roleIds.map(toPrimaryKey));
    if (!targetCodes.size) return;

    // System manage holders may grant anything.
    const systemPerms = await this.getPermissions(actorId, null);
    if (this.permissionIndexService.matchesAssigned(systemPerms, PERM.SYSTEM.MANAGE)) {
      return;
    }

    // Otherwise, evaluate caller's effective permissions in BOTH the system
    // scope and the target scope, then ensure every target code is granted.
    const scopedPerms = await this.getPermissions(actorId, actorGroupId);
    const callerEffective = new Set<string>([...systemPerms, ...scopedPerms]);

    for (const code of targetCodes) {
      // system.* requires system scope
      if (code.startsWith('system.') && !this.permissionIndexService.matchesAssigned(systemPerms, code)) {
        throw new ForbiddenException(
          t(this.i18n, 'rbac.PRIVILEGE_ESCALATION_BLOCKED', { code }),
        );
      }
      if (!this.permissionIndexService.matchesAssigned(callerEffective, code)) {
        throw new ForbiddenException(
          t(this.i18n, 'rbac.PRIVILEGE_ESCALATION_BLOCKED', { code }),
        );
      }
    }
  }

  /** Variant of assertCallerCanGrantRole that takes raw permission codes. */
  async assertCallerCanGrantPermissionCodes(
    actorId: RbacId,
    actorGroupId: NullableRbacId,
    targetCodes: string[],
  ): Promise<void> {
    if (!targetCodes.length) return;

    const systemPerms = await this.getPermissions(actorId, null);
    if (this.permissionIndexService.matchesAssigned(systemPerms, PERM.SYSTEM.MANAGE)) return;

    const scopedPerms = await this.getPermissions(actorId, actorGroupId);
    const callerEffective = new Set<string>([...systemPerms, ...scopedPerms]);

    for (const code of targetCodes) {
      if (code.startsWith('system.') && !this.permissionIndexService.matchesAssigned(systemPerms, code)) {
        throw new ForbiddenException(
          t(this.i18n, 'rbac.PRIVILEGE_ESCALATION_BLOCKED', { code }),
        );
      }
      if (!this.permissionIndexService.matchesAssigned(callerEffective, code)) {
        throw new ForbiddenException(
          t(this.i18n, 'rbac.PRIVILEGE_ESCALATION_BLOCKED', { code }),
        );
      }
    }
  }

  async assignRoleToUser(
    userId: RbacId,
    roleId: RbacId,
    groupId: RbacId,
    actor: { id: RbacId; groupId: NullableRbacId },
  ): Promise<void> {
    await this.assertCallerCanGrantRole(actor.id, actor.groupId, [toPrimaryKey(roleId)]);
    await this.roleAssignmentService.assignRoleToUser(userId, roleId, groupId);
    await this.rbacCache.bumpVersion();
    await this.rbacCache.clearAllUserCaches(userId);
    await this.refreshPermissions(userId, groupId);
  }

  async syncRolesInGroup(
    userId: RbacId,
    groupId: RbacId,
    roleIds: RbacId[],
    actor: { id: RbacId; groupId: NullableRbacId },
    skipValidation = false,
  ): Promise<void> {
    const targetIds = roleIds.map((r) => toPrimaryKey(r));

    // Assert caller can grant the NEW roles
    await this.assertCallerCanGrantRole(actor.id, actor.groupId, targetIds);

    // Assert caller can revoke the EXISTING roles BEFORE committing the sync.
    // This prevents a low-priv actor from revoking a high-priv role by omitting it.
    const existing = await this.rbacRepo.getExistingRoleIds(userId, groupId);
    if (existing.length) {
      await this.assertCallerCanGrantRole(actor.id, actor.groupId, existing);
    }

    await this.roleAssignmentService.syncRolesInGroup(
      userId,
      groupId,
      roleIds,
      skipValidation,
    );
    await this.rbacCache.bumpVersion();
    await this.rbacCache.clearAllUserCaches(userId);
    await this.refreshPermissions(userId, groupId);
  }

  hasCode(assigned: Set<string>, need: string): boolean {
    return this.permissionIndexService.matchesAssigned(assigned, need);
  }

  private scopeKey(userId: RbacId, groupId: NullableRbacId): string {
    return `${userId}:${groupId === null ? 'system' : groupId}`;
  }
}
