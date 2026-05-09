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
  api_path: true,
  type: true,
  status: true,
  sort_order: true,
  parent_id: true,
  required_permission_code: true,
  is_public: true,
  show_in_menu: true,
  group: true,
  created_at: true,
  updated_at: true,
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
      where.parent_id = filter.parentId === null ? null : toPrimaryKey(filter.parentId);
    }
    if (filter.group) where.group = filter.group;
    return where;
  }

  findMany(filter: MenuFilter, options: { skip: number; take: number }) {
    return this.prisma.menu.findMany({
      where: this.buildWhere(filter),
      select: DEFAULT_SELECT,
      // Tie-break by id so duplicate sort_order doesn't make pagination
      // non-deterministic (skipping/duplicating rows across pages).
      orderBy: [{ sort_order: 'asc' }, { id: 'asc' }],
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
      orderBy: [{ sort_order: 'asc' }, { id: 'asc' }],
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

    // Map camelCase DTO fields → snake_case Prisma fields
    if (payload.apiPath !== undefined) { payload.api_path = payload.apiPath; delete payload.apiPath; }
    if (payload.parentId !== undefined) { payload.parent_id = payload.parentId; delete payload.parentId; }
    if (payload.sortOrder !== undefined) { payload.sort_order = payload.sortOrder; delete payload.sortOrder; }
    if (payload.isPublic !== undefined) { payload.is_public = payload.isPublic; delete payload.isPublic; }
    if (payload.showInMenu !== undefined) { payload.show_in_menu = payload.showInMenu; delete payload.showInMenu; }
    if (payload.requiredPermissionCode !== undefined) {
      payload.required_permission_code = payload.requiredPermissionCode;
      delete payload.requiredPermissionCode;
    }

    // Convert BigInt fields
    const bigIntFields = ['parent_id', 'created_user_id', 'updated_user_id'];
    for (const field of bigIntFields) {
      const value = payload[field];
      if (value === undefined) continue;
      payload[field] = value === null || value === '' ? null : toPrimaryKey(value);
    }

    return payload;
  }
}
