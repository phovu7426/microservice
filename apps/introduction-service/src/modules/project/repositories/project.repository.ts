import { Injectable } from '@nestjs/common';
import { Prisma } from 'src/generated/prisma';
import { toPrimaryKey } from 'src/types';
import { PrismaService } from '../../../core/database/prisma.service';
import { BasicStatus } from '../../../common/enums/status.enum';

export interface ProjectFilter {
  search?: string;
  status?: string | string[];
  featured?: boolean;
  slug?: string;
}

const PUBLIC_INCLUDE = {
  testimonials: { where: { status: BasicStatus.active }, orderBy: { sortOrder: 'asc' as const } },
} as const;

@Injectable()
export class ProjectRepository {
  constructor(private readonly prisma: PrismaService) {}

  private buildWhere(filter: ProjectFilter): Prisma.ProjectWhereInput {
    const where: Prisma.ProjectWhereInput = {};
    if (filter.search) {
      const search = filter.search.slice(0, 100);
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { slug: { contains: search, mode: 'insensitive' } },
        { clientName: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (filter.status !== undefined) {
      where.status = Array.isArray(filter.status) ? { in: filter.status } : filter.status;
    }
    if (filter.featured !== undefined) where.featured = filter.featured;
    if (filter.slug) where.slug = filter.slug;
    return where;
  }

  // Don't bake `testimonials` into list queries — they're only needed on
  // detail. Including eagerly returned every testimonial × N projects per
  // page (payload bloat + perf foot-gun).
  findMany(filter: ProjectFilter, options: { skip: number; take: number }) {
    return this.prisma.project.findMany({
      where: this.buildWhere(filter),
      // Tie-break by id so duplicate sort_order is deterministic across pages.
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
      skip: options.skip,
      take: options.take,
    });
  }

  findManyPublic(filter: ProjectFilter, options: { skip: number; take: number }) {
    return this.prisma.project.findMany({
      where: this.buildWhere(filter),
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
      skip: options.skip,
      take: options.take,
    });
  }

  count(filter: ProjectFilter) {
    return this.prisma.project.count({ where: this.buildWhere(filter) });
  }

  findById(id: any) {
    return this.prisma.project.findUnique({
      where: { id: toPrimaryKey(id) },
      include: { testimonials: true },
    });
  }

  findBySlug(slug: string) {
    return this.prisma.project.findUnique({ where: { slug } });
  }

  findPublicBySlug(slug: string, statuses: string[]) {
    return this.prisma.project.findFirst({
      where: { slug, status: { in: statuses } },
      include: PUBLIC_INCLUDE,
    });
  }

  create(data: Record<string, any>) {
    return this.prisma.project.create({
      data: this.normalizePayload(data) as Prisma.ProjectUncheckedCreateInput,
      include: { testimonials: true },
    });
  }

  update(id: any, data: Record<string, any>) {
    return this.prisma.project.update({
      where: { id: toPrimaryKey(id) },
      data: this.normalizePayload(data) as Prisma.ProjectUncheckedUpdateInput,
      include: { testimonials: true },
    });
  }

  incrementViewCount(id: any) {
    return this.prisma.project.update({
      where: { id: toPrimaryKey(id) },
      data: { viewCount: { increment: 1 } },
    });
  }

  delete(id: any) {
    return this.prisma.project.delete({ where: { id: toPrimaryKey(id) } });
  }

  private normalizePayload(data: Record<string, any>): Record<string, any> {
    const payload = { ...data };
    if (payload.startDate && !(payload.startDate instanceof Date)) {
      payload.startDate = new Date(payload.startDate);
    }
    if (payload.endDate && !(payload.endDate instanceof Date)) {
      payload.endDate = new Date(payload.endDate);
    }
    return payload;
  }
}
