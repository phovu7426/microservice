import { Injectable } from '@nestjs/common';
import { Prisma } from 'src/generated/prisma';
import { CategoryStatus } from '../enums/category-status.enum';
import { toPrimaryKey } from 'src/types';
import { PrismaService } from '../../../core/database/prisma.service';

export interface CategoryFilter {
  search?: string;
  parentId?: any;
  status?: CategoryStatus;
}

const ALLOWED_FIELDS: ReadonlySet<string> = new Set([
  'name',
  'slug',
  'description',
  'parentId',
  'sortOrder',
  'status',
  'seoTitle',
  'seoDescription',
  'seoKeywords',
  'createdUserId',
  'updatedUserId',
]);

const SORTABLE_FIELDS: ReadonlySet<string> = new Set([
  'name',
  'sortOrder',
  'createdAt',
  'updatedAt',
]);

const WITH_CHILDREN = {
  children: { orderBy: { sortOrder: 'asc' as const } },
} as const;

const PUBLIC_TREE_SELECT = {
  id: true,
  name: true,
  slug: true,
  description: true,
  parentId: true,
  sortOrder: true,
  seoTitle: true,
  seoDescription: true,
  seoKeywords: true,
  children: {
    where: { status: CategoryStatus.active },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      sortOrder: true,
      seoTitle: true,
      seoDescription: true,
      seoKeywords: true,
    },
    orderBy: { sortOrder: 'asc' as const },
  },
} as const;

@Injectable()
export class CategoryRepository {
  constructor(private readonly prisma: PrismaService) {}

  private buildWhere(filter: CategoryFilter): Prisma.CategoryWhereInput {
    const where: Prisma.CategoryWhereInput = {};
    if (filter.search) {
      const search = filter.search.slice(0, 100);
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { slug: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (filter.parentId !== undefined) {
      where.parentId = filter.parentId === null ? null : toPrimaryKey(filter.parentId);
    }
    if (filter.status !== undefined) where.status = filter.status;
    return where;
  }

  /** Walk up the parent chain — used to detect cycles before saving. */
  async getParentId(id: bigint): Promise<bigint | null> {
    const row = await this.prisma.category.findUnique({
      where: { id },
      select: { parentId: true },
    });
    return row?.parentId ?? null;
  }

  findMany(filter: CategoryFilter, options: { skip: number; take: number }) {
    return this.prisma.category.findMany({
      where: this.buildWhere(filter),
      include: WITH_CHILDREN,
      orderBy: { sortOrder: 'asc' },
      skip: options.skip,
      take: options.take,
    });
  }

  count(filter: CategoryFilter) {
    return this.prisma.category.count({ where: this.buildWhere(filter) });
  }

  findById(id: any) {
    return this.prisma.category.findUnique({
      where: { id: toPrimaryKey(id) },
      include: WITH_CHILDREN,
    });
  }

  findBySlug(slug: string) {
    return this.prisma.category.findUnique({ where: { slug } });
  }

  findRootActiveTree() {
    return this.prisma.category.findMany({
      where: { status: CategoryStatus.active, parentId: null },
      select: PUBLIC_TREE_SELECT,
      orderBy: { sortOrder: 'asc' },
    });
  }

  create(data: Record<string, any>) {
    return this.prisma.category.create({
      data: this.normalizePayload(data) as Prisma.CategoryUncheckedCreateInput,
    });
  }

  update(id: any, data: Record<string, any>) {
    return this.prisma.category.update({
      where: { id: toPrimaryKey(id) },
      data: this.normalizePayload(data) as Prisma.CategoryUncheckedUpdateInput,
    });
  }

  delete(id: any) {
    return this.prisma.category.delete({ where: { id: toPrimaryKey(id) } });
  }

  private buildOrderBy(sort?: string): Prisma.CategoryOrderByWithRelationInput {
    if (!sort) return { sortOrder: 'asc' };
    const [field, dirRaw] = sort.split(':');
    if (!field || !SORTABLE_FIELDS.has(field)) return { sortOrder: 'asc' };
    const dir: 'asc' | 'desc' = dirRaw?.toLowerCase() === 'asc' ? 'asc' : 'desc';
    return { [field]: dir } as Prisma.CategoryOrderByWithRelationInput;
  }

  private normalizePayload(data: Record<string, any>): Record<string, any> {
    const payload: Record<string, any> = {};
    for (const key of Object.keys(data)) {
      if (ALLOWED_FIELDS.has(key)) payload[key] = data[key];
    }
    if (payload.parentId !== undefined) {
      payload.parentId =
        payload.parentId === null || payload.parentId === ''
          ? null
          : toPrimaryKey(payload.parentId);
    }
    const bigIntFields = ['createdUserId', 'updatedUserId'];
    for (const field of bigIntFields) {
      const value = payload[field];
      if (value === undefined) continue;
      payload[field] = value === null || value === '' ? null : toPrimaryKey(value);
    }
    return payload;
  }
}
