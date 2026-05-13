import { Injectable } from '@nestjs/common';
import { Menu, Prisma } from 'src/generated/prisma';
import { PrismaService } from '../../../core/database/prisma.service';
import { toPrimaryKey } from '../../../types';

export interface MenuFilter {
  search?: string;
  status?: string;
  parentId?: any;
  type?: string;
  group?: string;
}

const DEFAULT_SELECT = {
  id: true,
  code: true,
  name: true,
  icon: true,
  path: true,
  apiPath: true,
  type: true,
  status: true,
  sortOrder: true,
  parentId: true,
  requiredPermissionCode: true,
  isPublic: true,
  showInMenu: true,
  group: true,
  createdAt: true,
  updatedAt: true,
  parent: { select: { id: true, name: true, code: true } },
} as const;

@Injectable()
export class MenuRepository {
  constructor(private readonly prisma: PrismaService) {}

  private buildWhere(filter: MenuFilter): Prisma.MenuWhereInput {
    const where: Prisma.MenuWhereInput = {};
    if (filter.search) {
      // Postgres `contains` is case-sensitive by default — use insensitive mode.
      where.OR = [
        { name: { contains: filter.search, mode: 'insensitive' } },
        { code: { contains: filter.search, mode: 'insensitive' } },
      ];
    }
    if (filter.status) where.status = filter.status as any;
    if (filter.type) where.type = filter.type as any;
    if (filter.parentId !== undefined) {
      where.parentId = filter.parentId === null ? null : toPrimaryKey(filter.parentId);
    }
    if (filter.group) where.group = filter.group;
    return where;
  }

  findMany(filter: MenuFilter, options: { skip: number; take: number }) {
    return this.prisma.menu.findMany({
      where: this.buildWhere(filter),
      select: DEFAULT_SELECT,
      // Tie-break by id so duplicate sortOrder doesn't make pagination
      // non-deterministic (skipping/duplicating rows across pages).
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
      skip: options.skip,
      take: options.take,
    });
  }

  count(filter: MenuFilter) {
    return this.prisma.menu.count({ where: this.buildWhere(filter) });
  }

  findById(id: any): Promise<Menu | null> {
    return this.prisma.menu.findUnique({
      where: { id: toPrimaryKey(id) },
      select: DEFAULT_SELECT,
    }) as any;
  }

  findByCode(code: string): Promise<Menu | null> {
    return this.prisma.menu.findFirst({
      where: { code },
      select: DEFAULT_SELECT,
    }) as any;
  }

  findAllWithChildren(filter: MenuFilter = {}): Promise<Menu[]> {
    return this.prisma.menu.findMany({
      where: this.buildWhere(filter),
      select: DEFAULT_SELECT,
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    }) as any;
  }

  create(data: Record<string, any>): Promise<Menu> {
    return this.prisma.menu.create({
      data: this.normalizePayload(data) as Prisma.MenuCreateInput,
      select: DEFAULT_SELECT,
    }) as any;
  }

  update(id: any, data: Record<string, any>): Promise<Menu> {
    return this.prisma.menu.update({
      where: { id: toPrimaryKey(id) },
      data: this.normalizePayload(data) as Prisma.MenuUpdateInput,
      select: DEFAULT_SELECT,
    }) as any;
  }

  delete(id: any) {
    return this.prisma.menu.delete({ where: { id: toPrimaryKey(id) } });
  }

  private normalizePayload(data: Record<string, any>): Record<string, any> {
    const payload = { ...data };

    // Convert BigInt fields
    const bigIntFields = ['parentId', 'createdUserId', 'updatedUserId'];
    for (const field of bigIntFields) {
      const value = payload[field];
      if (value === undefined) continue;
      payload[field] = value === null || value === '' ? null : toPrimaryKey(value);
    }

    return payload;
  }
}
