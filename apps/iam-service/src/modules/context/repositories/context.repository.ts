import { Injectable } from '@nestjs/common';
import { Prisma } from 'src/generated/prisma';
import { PrismaService } from '../../../core/database/prisma.service';
import { toPrimaryKey } from 'src/types';

export interface ContextFilter {
  search?: string;
  type?: string;
  status?: string;
}

const LIST_SELECT = {
  id: true,
  code: true,
  name: true,
  type: true,
  status: true,
  createdAt: true,
} satisfies Prisma.ContextSelect;

@Injectable()
export class ContextRepository {
  constructor(private readonly prisma: PrismaService) {}

  private buildWhere(filter: ContextFilter): Prisma.ContextWhereInput {
    const where: Prisma.ContextWhereInput = {};
    const andConditions: Prisma.ContextWhereInput[] = [];

    if (filter.search) {
      andConditions.push({
        OR: [
          { code: { startsWith: filter.search, mode: 'insensitive' } },
          { name: { startsWith: filter.search, mode: 'insensitive' } },
        ],
      });
    }

    if (filter.status) {
      andConditions.push({ status: filter.status });
    }

    if (filter.type) {
      andConditions.push({ type: filter.type });
    }

    if (andConditions.length > 0) {
      where.AND = andConditions;
    }

    return where;
  }

  findMany(filter: ContextFilter, options: { skip: number; take: number; orderBy?: any }) {
    return this.prisma.context.findMany({
      where: this.buildWhere(filter),
      select: LIST_SELECT,
      skip: options.skip,
      take: options.take,
      orderBy: options.orderBy ?? { code: 'asc' },
    });
  }

  count(filter: ContextFilter) {
    return this.prisma.context.count({ where: this.buildWhere(filter) });
  }

  findById(id: string | bigint) {
    return this.prisma.context.findUnique({
      where: { id: toPrimaryKey(id) },
      include: {
        roleContexts: {
          include: { role: { select: { id: true, code: true, name: true } } },
        },
      },
    });
  }

  findByCode(code: string) {
    return this.prisma.context.findUnique({ where: { code } });
  }

  create(data: any) {
    return this.prisma.context.create({ data });
  }

  update(id: string | bigint, data: any) {
    return this.prisma.context.update({ where: { id: toPrimaryKey(id) }, data });
  }

  delete(id: string | bigint) {
    return this.prisma.context.delete({ where: { id: toPrimaryKey(id) } });
  }

  async syncRoles(contextId: string | bigint, roleIds: (string | bigint)[]) {
    const ctxId = toPrimaryKey(contextId);
    const pkRoleIds = roleIds.map(toPrimaryKey);
    await this.prisma.$transaction(
      async (tx) => {
        const before = await tx.roleContext.findMany({
          where: { contextId: ctxId },
          select: { roleId: true },
        });
        const beforeIds = new Set(before.map((r) => String(r.roleId)));
        const targetIds = new Set(pkRoleIds.map((id) => String(id)));
        const removed = [...beforeIds].filter((id) => !targetIds.has(id)).map((id) => toPrimaryKey(id));

        await tx.roleContext.deleteMany({ where: { contextId: ctxId } });
        if (pkRoleIds.length) {
          await tx.roleContext.createMany({
            data: pkRoleIds.map((rid) => ({ roleId: rid, contextId: ctxId })),
            skipDuplicates: true,
          });
        }

        if (removed.length) {
          await tx.userRoleAssignment.deleteMany({
            where: {
              roleId: { in: removed },
              group: { contextId: ctxId },
            },
          });
        }
      },
      { isolationLevel: 'Serializable' },
    );
  }

  async countGroups(contextId: string | bigint): Promise<number> {
    return this.prisma.group.count({ where: { contextId: toPrimaryKey(contextId) } });
  }
}
