import { Injectable } from '@nestjs/common';
import { Prisma } from 'src/generated/prisma';
import { PrismaService } from '../../../core/database/prisma.service';
import { toPrimaryKey } from 'src/types';

export interface PermissionFilter {
  search?: string;
  status?: string;
  scope?: string;
  parentId?: any;
}

const LIST_SELECT = {
  id: true,
  code: true,
  name: true,
  status: true,
  parentId: true,
  parent: { select: { id: true, code: true, name: true } },
  createdAt: true,
} satisfies Prisma.PermissionSelect;

@Injectable()
export class PermissionRepository {
  constructor(private readonly prisma: PrismaService) {}

  private buildWhere(filter: PermissionFilter): Prisma.PermissionWhereInput {
    const where: Prisma.PermissionWhereInput = {};
    const andConditions: Prisma.PermissionWhereInput[] = [];

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

    if (filter.scope) {
      andConditions.push({ scope: filter.scope });
    }

    if (filter.parentId) {
      andConditions.push({ parentId: toPrimaryKey(filter.parentId) });
    }

    if (andConditions.length > 0) {
      where.AND = andConditions;
    }

    return where;
  }

  findMany(filter: PermissionFilter, options: { skip: number; take: number; orderBy?: any }) {
    return this.prisma.permission.findMany({
      where: this.buildWhere(filter),
      select: LIST_SELECT,
      skip: options.skip,
      take: options.take,
      orderBy: options.orderBy ?? { code: 'asc' },
    });
  }

  count(filter: PermissionFilter) {
    return this.prisma.permission.count({ where: this.buildWhere(filter) });
  }

  findById(id: string | bigint) {
    return this.prisma.permission.findUnique({
      where: { id: toPrimaryKey(id) },
      include: {
        parent: { select: { id: true, code: true, name: true } },
        children: { select: { id: true, code: true, name: true } },
      },
    });
  }

  findByCode(code: string) {
    return this.prisma.permission.findUnique({ where: { code } });
  }

  create(data: any) {
    return this.prisma.permission.create({ data });
  }

  update(id: string | bigint, data: any) {
    return this.prisma.permission.update({ where: { id: toPrimaryKey(id) }, data });
  }

  delete(id: string | bigint) {
    return this.prisma.permission.delete({ where: { id: toPrimaryKey(id) } });
  }

  findSimple(search?: string) {
    const where: Prisma.PermissionWhereInput = search
      ? {
          OR: [
            { code: { contains: search, mode: 'insensitive' } },
            { name: { contains: search, mode: 'insensitive' } },
          ],
        }
      : {};
    return this.prisma.permission.findMany({
      where,
      select: { id: true, code: true, name: true },
      orderBy: { code: 'asc' },
      take: 200,
    });
  }

  async getParentId(id: bigint): Promise<bigint | null> {
    const row = await this.prisma.permission.findUnique({
      where: { id },
      select: { parentId: true },
    });
    return row?.parentId ?? null;
  }
}
