import { Injectable } from '@nestjs/common';
import { Prisma } from 'src/generated/prisma';
import { toPrimaryKey } from 'src/types';
import { PrismaService } from '../../../core/database/prisma.service';
import { BasicStatus } from '../../../common/enums/status.enum';

export interface TestimonialFilter {
  search?: string;
  status?: string;
  featured?: boolean;
  projectId?: any;
}

const PROJECT_SELECT = { id: true, name: true, slug: true } as const;

@Injectable()
export class TestimonialRepository {
  constructor(private readonly prisma: PrismaService) {}

  private buildWhere(filter: TestimonialFilter): Prisma.TestimonialWhereInput {
    const where: Prisma.TestimonialWhereInput = {};
    if (filter.search) {
      where.OR = [
        { clientName: { contains: filter.search.slice(0, 100), mode: 'insensitive' } },
        { clientCompany: { contains: filter.search.slice(0, 100), mode: 'insensitive' } },
        { content: { contains: filter.search.slice(0, 100), mode: 'insensitive' } },
      ];
    }
    if (filter.status) where.status = filter.status;
    if (filter.featured !== undefined) where.featured = filter.featured;
    if (filter.projectId !== undefined) where.projectId = toPrimaryKey(filter.projectId);
    return where;
  }

  findMany(filter: TestimonialFilter, options: { skip: number; take: number }) {
    return this.prisma.testimonial.findMany({
      where: this.buildWhere(filter),
      include: { project: { select: PROJECT_SELECT } },
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
      skip: options.skip,
      take: options.take,
    });
  }

  count(filter: TestimonialFilter) {
    return this.prisma.testimonial.count({ where: this.buildWhere(filter) });
  }

  findById(id: any) {
    return this.prisma.testimonial.findUnique({
      where: { id: toPrimaryKey(id) },
      include: { project: { select: PROJECT_SELECT } },
    });
  }

  findActiveById(id: any) {
    return this.prisma.testimonial.findFirst({
      where: { id: toPrimaryKey(id), status: BasicStatus.active },
      include: { project: { select: PROJECT_SELECT } },
    });
  }

  create(data: Record<string, any>) {
    return this.prisma.testimonial.create({
      data: this.normalizePayload(data) as Prisma.TestimonialUncheckedCreateInput,
      include: { project: { select: PROJECT_SELECT } },
    });
  }

  update(id: any, data: Record<string, any>) {
    return this.prisma.testimonial.update({
      where: { id: toPrimaryKey(id) },
      data: this.normalizePayload(data) as Prisma.TestimonialUncheckedUpdateInput,
      include: { project: { select: PROJECT_SELECT } },
    });
  }

  delete(id: any) {
    return this.prisma.testimonial.delete({ where: { id: toPrimaryKey(id) } });
  }

  private normalizePayload(data: Record<string, any>): Record<string, any> {
    const payload = { ...data };
    if (payload.projectId !== undefined) {
      payload.projectId = payload.projectId === null || payload.projectId === ''
        ? null
        : toPrimaryKey(payload.projectId);
    }
    return payload;
  }
}
