import { Injectable } from '@nestjs/common';
import { Prisma } from 'src/generated/prisma';
import { PrismaService } from '../../../core/database/prisma.service';
import { PrimaryKey, toPrimaryKey } from 'src/types';
import { BasicStatus } from '../../../common/enums/basic-status.enum';

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
      andConditions.push({ userId: toPrimaryKey(filter.userId) });
    }

    if (filter.roleId) {
      andConditions.push({ roleId: toPrimaryKey(filter.roleId) });
    }

    if (filter.groupId) {
      andConditions.push({ groupId: toPrimaryKey(filter.groupId) });
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
      orderBy: options.orderBy ?? { createdAt: 'desc' },
    });
  }

  count(filter: UserRoleFilter) {
    return this.prisma.userRoleAssignment.count({ where: this.buildWhere(filter) });
  }

  getUserRoles(userId: string | bigint, groupId?: string | bigint) {
    const where: any = { userId: toPrimaryKey(userId) };
    if (groupId !== undefined) where.groupId = toPrimaryKey(groupId);
    return this.prisma.userRoleAssignment.findMany({
      where,
      include: {
        role: { select: { id: true, code: true, name: true } },
        group: { select: { id: true, code: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async removeRole(
    userId: string | bigint,
    roleId: string | bigint,
    groupId: string | bigint,
  ): Promise<number> {
    const result = await this.prisma.userRoleAssignment.deleteMany({
      where: {
        userId: toPrimaryKey(userId),
        roleId: toPrimaryKey(roleId),
        groupId: toPrimaryKey(groupId),
      },
    });
    return result.count;
  }

  async getActiveRoleIdsForUserInGroup(
    userId: PrimaryKey,
    groupId: PrimaryKey | null,
  ): Promise<bigint[]> {
    const where: any = { userId: userId };
    if (groupId === null) {
      where.group = { context: { type: 'system', status: BasicStatus.active }, status: BasicStatus.active };
    } else {
      where.groupId = groupId;
    }
    const rows = await this.prisma.userRoleAssignment.findMany({
      where,
      select: { roleId: true },
    });
    return rows.map((r) => r.roleId);
  }
}
