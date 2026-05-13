import { Injectable } from '@nestjs/common';
import { Prisma } from 'src/generated/prisma';
import { toPrimaryKey } from 'src/types';
import { PrismaService } from '../../../core/database/prisma.service';

const ALLOWED_FIELDS: ReadonlySet<string> = new Set([
  'name',
  'slug',
  'description',
  'createdUserId',
  'updatedUserId',
]);

export interface CategoryFilter {
  search?: string;
}

@Injectable()
export class CategoryRepository {
  constructor(private readonly prisma: PrismaService) {}

  private buildWhere(filter: CategoryFilter): Prisma.CategoryWhereInput {
    const where: Prisma.CategoryWhereInput = {};
    if (filter.search) {
      where.OR = [
        { name: { contains: filter.search } },
        { slug: { contains: filter.search } },
      ];
    }
    return where;
  }

  findMany(filter: CategoryFilter, options: { skip: number; take: number }) {
    return this.prisma.category.findMany({
      where: this.buildWhere(filter),
      orderBy: { name: 'asc' },
      skip: options.skip,
      take: options.take,
    });
  }

  count(filter: CategoryFilter) {
    return this.prisma.category.count({ where: this.buildWhere(filter) });
  }

  findById(id: any) {
    return this.prisma.category.findUnique({ where: { id: toPrimaryKey(id) } });
  }

  findBySlug(slug: string) {
    return this.prisma.category.findUnique({ where: { slug } });
  }

  findAll() {
    return this.prisma.category.findMany({
      select: { id: true, name: true, slug: true, description: true },
      orderBy: { name: 'asc' },
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
