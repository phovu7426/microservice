import { Injectable } from '@nestjs/common';
import { Prisma } from 'src/generated/prisma';
import { PrismaService } from '../../../core/database/prisma.service';
import { PrimaryKey } from 'src/types';

export interface ContentTemplateFilter {
  search?: string;
  type?: string;
  category?: string;
  status?: string;
  code?: string;
}

@Injectable()
export class ContentTemplateRepository {
  constructor(private readonly prisma: PrismaService) {}

  private buildWhere(filter: ContentTemplateFilter): Prisma.ContentTemplateWhereInput {
    const where: Prisma.ContentTemplateWhereInput = {};
    if (filter.search) {
      where.OR = [
        { name: { contains: filter.search, mode: 'insensitive' } },
        { code: { contains: filter.search, mode: 'insensitive' } },
      ];
    }
    if (filter.type) where.type = filter.type;
    if (filter.category) where.category = filter.category;
    if (filter.status) where.status = filter.status;
    if (filter.code) where.code = filter.code;
    return where;
  }

  findMany(filter: ContentTemplateFilter, options: { skip: number; take: number; sortBy?: string; order?: 'asc' | 'desc' }) {
    return this.prisma.contentTemplate.findMany({
      where: this.buildWhere(filter),
      orderBy: options.sortBy ? { [options.sortBy]: options.order ?? 'desc' } : { created_at: 'desc' },
      skip: options.skip,
      take: options.take,
    });
  }

  count(filter: ContentTemplateFilter) {
    return this.prisma.contentTemplate.count({ where: this.buildWhere(filter) });
  }

  findById(id: PrimaryKey) {
    return this.prisma.contentTemplate.findUnique({ where: { id } });
  }

  findByCode(code: string) {
    return this.prisma.contentTemplate.findUnique({ where: { code } });
  }

  findFirst(where: Prisma.ContentTemplateWhereInput) {
    return this.prisma.contentTemplate.findFirst({ where });
  }

  findActiveByCode(code: string) {
    return this.prisma.contentTemplate.findFirst({
      where: { code, status: 'active', category: 'render', type: 'email' },
    });
  }

  create(data: Prisma.ContentTemplateCreateInput) {
    return this.prisma.contentTemplate.create({ data });
  }

  update(id: PrimaryKey, data: Prisma.ContentTemplateUpdateInput) {
    return this.prisma.contentTemplate.update({ where: { id }, data });
  }

  delete(id: PrimaryKey) {
    return this.prisma.contentTemplate.delete({ where: { id } });
  }
}
