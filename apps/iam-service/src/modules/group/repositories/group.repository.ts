import { Injectable } from '@nestjs/common';
import { Prisma } from 'src/generated/prisma';
import { PrismaService } from '../../../core/database/prisma.service';
import { toPrimaryKey } from 'src/types';

export interface GroupFilter {
  search?: string;
  type?: string;
  status?: string;
  contextId?: any;
}

const LIST_SELECT = {
  id: true,
  code: true,
  name: true,
  description: true,
  status: true,
  contextId: true,
  context: { select: { id: true, code: true, name: true } },
  createdAt: true,
} satisfies Prisma.GroupSelect;

@Injectable()
export class GroupRepository {
  constructor(private readonly prisma: PrismaService) {}

  private buildWhere(filter: GroupFilter): Prisma.GroupWhereInput {
    const where: Prisma.GroupWhereInput = {};
    const andConditions: Prisma.GroupWhereInput[] = [];

    if (filter.search) {
      andConditions.push({
        OR: [
          { code: { startsWith: filter.search, mode: 'insensitive' } },
          { name: { startsWith: filter.search, mode: 'insensitive' } },
        ],
      });
    }

    if (filter.type) {
      andConditions.push({ type: filter.type });
    }

    if (filter.status) {
      andConditions.push({ status: filter.status });
    }

    if (filter.contextId) {
      andConditions.push({ contextId: toPrimaryKey(filter.contextId) });
    }

    if (andConditions.length > 0) {
      where.AND = andConditions;
    }

    return where;
  }

  findMany(filter: GroupFilter, options: { skip: number; take: number; orderBy?: any }) {
    return this.prisma.group.findMany({
      where: this.buildWhere(filter),
      select: LIST_SELECT,
      skip: options.skip,
      take: options.take,
      orderBy: options.orderBy ?? { createdAt: 'desc' },
    });
  }

  count(filter: GroupFilter) {
    return this.prisma.group.count({ where: this.buildWhere(filter) });
  }

  findById(id: string | bigint) {
    return this.prisma.group.findUnique({
      where: { id: toPrimaryKey(id) },
      include: { context: { select: { id: true, code: true, name: true } } },
    });
  }

  findByCode(code: string) {
    return this.prisma.group.findFirst({ where: { code } });
  }

  create(data: any) {
    return this.prisma.group.create({ data });
  }

  update(id: string | bigint, data: any) {
    return this.prisma.group.update({ where: { id: toPrimaryKey(id) }, data });
  }

  delete(id: string | bigint) {
    return this.prisma.group.delete({ where: { id: toPrimaryKey(id) } });
  }

  getMembers(groupId: string | bigint, skip: number, take: number) {
    return this.prisma.userGroup.findMany({
      where: { groupId: toPrimaryKey(groupId) },
      orderBy: { joinedAt: 'desc' },
      skip,
      take,
    });
  }

  countMembers(groupId: string | bigint) {
    return this.prisma.userGroup.count({ where: { groupId: toPrimaryKey(groupId) } });
  }

  addMember(groupId: string | bigint, userId: string | bigint) {
    const gid = toPrimaryKey(groupId);
    const uid = toPrimaryKey(userId);
    return this.prisma.userGroup.upsert({
      where: { userId_groupId: { userId: uid, groupId: gid } },
      create: { userId: uid, groupId: gid },
      update: {},
    });
  }

  findUserGroups(userId: string | bigint) {
    const uid = toPrimaryKey(userId);
    return this.prisma.userGroup.findMany({
      where: { userId: uid },
      include: {
        group: {
          select: {
            id: true,
            code: true,
            name: true,
            type: true,
            status: true,
            description: true,
            contextId: true,
            ownerId: true,
            metadata: true,
          },
        },
      },
      orderBy: { joinedAt: 'asc' },
    });
  }

  removeMember(groupId: string | bigint, userId: string | bigint) {
    const gid = toPrimaryKey(groupId);
    const uid = toPrimaryKey(userId);
    return this.prisma.userGroup.delete({
      where: { userId_groupId: { userId: uid, groupId: gid } },
    });
  }
}
