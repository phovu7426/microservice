import { Injectable } from '@nestjs/common';
import { Prisma } from 'src/generated/prisma';
import { PrismaService } from '../../../core/database/prisma.service';
import { PrimaryKey, toPrimaryKey } from 'src/types';

export interface UserRoleFilter {
  userId?: any;
  groupId?: any;
  roleId?: any;
}

@Injectable()
export class UserRoleRepository {
  constructor(private readonly prisma: PrismaService) {}

  private buildWhere(filter: UserRoleFilter): Prisma.UserRoleAssignmentWhereInput {
    const where: Prisma.UserRoleAssignmentWhereInput = {};
    const andConditions: Prisma.UserRoleAssignmentWhereInput[] = [];

    if (filter.userId) {
      andConditions.push({ user_id: toPrimaryKey(filter.userId) });
    }

    if (filter.roleId) {
      andConditions.push({ role_id: toPrimaryKey(filter.roleId) });
    }

    if (filter.groupId) {
      andConditions.push({ group_id: toPrimaryKey(filter.groupId) });
    }

    if (andConditions.length > 0) {
      where.AND = andConditions;
    }

    return where;
  }

  findMany(filter: UserRoleFilter, options: { skip: number; take: number; orderBy?: any }) {
    return this.prisma.userRoleAssignment.findMany({
      where: this.buildWhere(filter),
      include: {
        role: { select: { id: true, code: true, name: true } },
        group: { select: { id: true, code: true, name: true } },
      },
      skip: options.skip,
      take: options.take,
      orderBy: options.orderBy ?? { created_at: 'desc' },
    });
  }

  count(filter: UserRoleFilter) {
    return this.prisma.userRoleAssignment.count({ where: this.buildWhere(filter) });
  }

  getUserRoles(userId: string | bigint, groupId?: string | bigint) {
    const where: any = { user_id: toPrimaryKey(userId) };
    if (groupId !== undefined) where.group_id = toPrimaryKey(groupId);
    return this.prisma.userRoleAssignment.findMany({
      where,
      include: {
        role: { select: { id: true, code: true, name: true } },
        group: { select: { id: true, code: true, name: true } },
      },
      orderBy: { created_at: 'desc' },
    });
  }

  async removeRole(
    userId: string | bigint,
    roleId: string | bigint,
    groupId: string | bigint,
  ): Promise<number> {
    const result = await this.prisma.userRoleAssignment.deleteMany({
      where: {
        user_id: toPrimaryKey(userId),
        role_id: toPrimaryKey(roleId),
        group_id: toPrimaryKey(groupId),
      },
    });
    return result.count;
  }

  async getActiveRoleIdsForUserInGroup(
    userId: PrimaryKey,
    groupId: PrimaryKey | null,
  ): Promise<bigint[]> {
    const where: any = { user_id: userId };
    if (groupId === null) {
      where.group = { context: { type: 'system', status: 'active' }, status: 'active' };
    } else {
      where.group_id = groupId;
    }
    const rows = await this.prisma.userRoleAssignment.findMany({
      where,
      select: { role_id: true },
    });
    return rows.map((r) => r.role_id);
  }
}
