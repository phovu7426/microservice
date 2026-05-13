import { Injectable } from '@nestjs/common';
import { Prisma } from 'src/generated/prisma';
import { toPrimaryKey } from 'src/types';
import { PrismaService } from '../../../core/database/prisma.service';

export interface TagFilter {
  search?: string;
  isActive?: boolean;
}

const ALLOWED_FIELDS: ReadonlySet<string> = new Set([
  'name',
  'slug',
  'description',
  'isActive',
  'createdUserId',
  'updatedUserId',
]);

const SORTABLE_FIELDS: ReadonlySet<string> = new Set([
  'name',
  'createdAt',
  'updatedAt',
]);

@Injectable()
export class TagRepository {
  constructor(private readonly prisma: PrismaService) {}

  private buildWhere(filter: TagFilter): Prisma.TagWhereInput {
    const where: Prisma.TagWhereInput = {};
    if (filter.search) {
      const search = filter.search.slice(0, 100);
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { slug: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (filter.isActive !== undefined) where.isActive = filter.isActive;
    return where;
  }

  private buildOrderBy(sort?: string): Prisma.TagOrderByWithRelationInput {
    if (!sort) return { name: 'asc' };
    const [field, dirRaw] = sort.split(':');
    if (!field || !SORTABLE_FIELDS.has(field)) return { name: 'asc' };
    const dir: 'asc' | 'desc' = dirRaw?.toLowerCase() === 'asc' ? 'asc' : 'desc';
    return { [field]: dir } as Prisma.TagOrderByWithRelationInput;
  }

  findMany(filter: TagFilter, options: { skip: number; take: number }) {
    return this.prisma.tag.findMany({
      where: this.buildWhere(filter),
      orderBy: { name: 'asc' },
      skip: options.skip,
      take: options.take,
    });
  }

  count(filter: TagFilter) {
    return this.prisma.tag.count({ where: this.buildWhere(filter) });
  }

  findById(id: any) {
    return this.prisma.tag.findUnique({ where: { id: toPrimaryKey(id) } });
  }

  findBySlug(slug: string) {
    return this.prisma.tag.findUnique({ where: { slug } });
  }

  findAllActive() {
    return this.prisma.tag.findMany({
      where: { isActive: true },
      select: { id: true, name: true, slug: true, description: true },
      orderBy: { name: 'asc' },
    });
  }

  create(data: Record<string, any>) {
    return this.prisma.tag.create({
      data: this.normalizePayload(data) as Prisma.TagUncheckedCreateInput,
    });
  }

  update(id: any, data: Record<string, any>) {
    return this.prisma.tag.update({
      where: { id: toPrimaryKey(id) },
      data: this.normalizePayload(data) as Prisma.TagUncheckedUpdateInput,
    });
  }

  delete(id: any) {
    return this.prisma.tag.delete({ where: { id: toPrimaryKey(id) } });
  }

  private normalizePayload(data: Record<string, any>): Record<string, any> {
    const payload: Record<string, any> = {};
    for (const key of Object.keys(data)) {
      if (ALLOWED_FIELDS.has(key)) payload[key] = data[key];
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
