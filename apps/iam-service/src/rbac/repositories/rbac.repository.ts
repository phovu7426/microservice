import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { toPrimaryKey } from 'src/types';
import { RbacId } from '../types';

function toPk(id: RbacId): bigint {
  return toPrimaryKey(id);
}

export const SYSTEM_CONTEXT_TYPE = 'system';

@Injectable()
export class RbacRepository {
  constructor(private readonly prisma: PrismaService) {}

  findPermissions() {
    return this.prisma.permission.findMany({
      where: { status: 'active' },
      select: { id: true, code: true, parent_id: true },
    });
  }

  assignRoleToUser(userId: RbacId, roleId: RbacId, groupId: RbacId) {
    return this.prisma.userRoleAssignment.createMany({
      data: [{ user_id: toPk(userId), role_id: toPk(roleId), group_id: toPk(groupId) }],
      skipDuplicates: true,
    });
  }

  findActiveGroup(groupId: RbacId) {
    return this.prisma.group.findFirst({
      where: { id: toPk(groupId), status: 'active' },
    });
  }

  async syncRolesInGroup(
    userId: RbacId,
    groupId: RbacId,
    roleIds: RbacId[],
    contextId: bigint,
    skipValidation = false,
  ): Promise<{ before: bigint[]; after: bigint[] }> {
    const normalizedRoleIds = this.normalizeRoleIds(roleIds);

    if (normalizedRoleIds.length && !skipValidation) {
      const invalidIds = await this.findInvalidRolesForContext(normalizedRoleIds, contextId);
      if (invalidIds.length) {
        return { before: [], after: [], ...{ invalidRoleIds: invalidIds } } as any;
      }
    }

    return this.prisma.$transaction(
      async (tx) => {
        const existing = await tx.userRoleAssignment.findMany({
          where: { user_id: toPk(userId), group_id: toPk(groupId) },
          select: { role_id: true },
        });
        const before = existing.map((e) => e.role_id);

        if (normalizedRoleIds.length > 0) {
          await tx.userGroup.upsert({
            where: { user_id_group_id: { user_id: toPk(userId), group_id: toPk(groupId) } },
            create: { user_id: toPk(userId), group_id: toPk(groupId), joined_at: new Date() },
            update: {},
          });
        }
        await tx.userRoleAssignment.deleteMany({
          where: { user_id: toPk(userId), group_id: toPk(groupId) },
        });
        if (normalizedRoleIds.length > 0) {
          await tx.userRoleAssignment.createMany({
            data: normalizedRoleIds.map((rid) => ({
              user_id: toPk(userId),
              group_id: toPk(groupId),
              role_id: toPk(rid),
            })),
            skipDuplicates: true,
          });
        }
        return { before, after: normalizedRoleIds.map((id) => toPk(id)) };
      },
      { isolationLevel: 'Serializable' },
    );
  }

  /**
   * Resolve the user's effective permission codes.
   *
   * Filters every layer that should silently revoke access:
   *   - role.status active
   *   - permission.status active
   *   - group.status active
   *   - context.status active
   *   - system scope determined by context.type='system' (NOT group.code)
   *
   * Stale `user_role_assignments` produced when a role is later removed from
   * a context are cleaned in {@link cleanupOrphanedAssignmentsForContext}; we
   * intentionally do not re-validate role/context membership at read time
   * because Prisma cannot express the correlated check efficiently.
   */
  async getActivePermissionCodes(userId: RbacId, groupId: RbacId | null): Promise<string[]> {
    const groupFilter =
      groupId === null
        ? { status: 'active', context: { type: SYSTEM_CONTEXT_TYPE, status: 'active' } }
        : { id: toPk(groupId), status: 'active', context: { status: 'active' } };

    const rows = await this.prisma.roleHasPermission.findMany({
      where: {
        role: {
          status: 'active',
          user_role_assignments: {
            some: {
              user_id: toPk(userId),
              group: groupFilter,
            },
          },
        },
        permission: { status: 'active' },
      },
      select: { permission: { select: { code: true } } },
    });
    const out = new Set<string>();
    for (const r of rows as any[]) {
      const code = r?.permission?.code;
      if (typeof code === 'string' && code.length) out.add(code);
    }
    return Array.from(out);
  }

  /** Remove orphan assignments after a role is unsynced from a context. */
  async cleanupOrphanedAssignmentsForContext(contextId: bigint, removedRoleIds: bigint[]) {
    if (!removedRoleIds.length) return;
    await this.prisma.userRoleAssignment.deleteMany({
      where: {
        role_id: { in: removedRoleIds },
        group: { context_id: contextId },
      },
    });
  }

  /** Get existing role IDs for a user in a group (for pre-sync validation). */
  async getExistingRoleIds(userId: RbacId, groupId: RbacId): Promise<bigint[]> {
    const rows = await this.prisma.userRoleAssignment.findMany({
      where: { user_id: toPk(userId), group_id: toPk(groupId) },
      select: { role_id: true },
    });
    return rows.map((r) => r.role_id);
  }

  /** Number of users currently holding a given permission via any role. */
  async countUsersWithPermission(permissionCode: string): Promise<number> {
    const rows = await this.prisma.userRoleAssignment.findMany({
      where: {
        role: {
          status: 'active',
          permissions: { some: { permission: { code: permissionCode, status: 'active' } } },
        },
        group: { status: 'active', context: { status: 'active' } },
      },
      select: { user_id: true },
      distinct: ['user_id'],
    });
    return rows.length;
  }

  /** Permission codes contained in a given role (active permissions only). */
  async getPermissionCodesForRoles(roleIds: (string | bigint)[]): Promise<Set<string>> {
    if (!roleIds.length) return new Set();
    const rows = await this.prisma.roleHasPermission.findMany({
      where: { role_id: { in: roleIds.map((id) => typeof id === 'bigint' ? id : BigInt(id)) }, permission: { status: 'active' } },
      select: { permission: { select: { code: true } } },
    });
    const out = new Set<string>();
    for (const r of rows as any[]) {
      const code = r?.permission?.code;
      if (typeof code === 'string' && code.length) out.add(code);
    }
    return out;
  }

  /** Returns role IDs that are NOT valid (not linked or inactive) for the given context. */
  async findInvalidRolesForContext(roleIds: RbacId[], contextId: bigint): Promise<string[]> {
    const normalizedRoleIds = roleIds.map((id) => toPk(id));
    const links = await this.prisma.roleContext.findMany({
      where: {
        context_id: contextId,
        role_id: { in: normalizedRoleIds },
        role: { status: 'active' },
      },
      select: { role_id: true },
    });
    const validIds = new Set((links as any[]).map((l) => String(l.role_id)));
    return normalizedRoleIds
      .filter((id) => !validIds.has(String(id)))
      .map(String);
  }

  private normalizeRoleIds(roleIds: RbacId[] | null | undefined): RbacId[] {
    if (!Array.isArray(roleIds)) return [];
    return roleIds.filter(
      (id) => id !== null && id !== undefined && `${id}`.trim().length > 0,
    );
  }
}
