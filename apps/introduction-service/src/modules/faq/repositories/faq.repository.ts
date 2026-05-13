import { Injectable } from '@nestjs/common';
import { Prisma } from 'src/generated/prisma';
import { toPrimaryKey } from 'src/types';
import { PrismaService } from '../../../core/database/prisma.service';
import { BasicStatus } from '../../../common/enums/status.enum';

export interface FaqFilter {
  search?: string;
  status?: string;
}

@Injectable()
export class FaqRepository {
  constructor(private readonly prisma: PrismaService) {}

  private buildWhere(filter: FaqFilter): Prisma.FaqWhereInput {
    const where: Prisma.FaqWhereInput = {};
    if (filter.search) {
      where.OR = [
        { question: { contains: filter.search.slice(0, 100), mode: 'insensitive' } },
        { answer: { contains: filter.search.slice(0, 100), mode: 'insensitive' } },
      ];
    }
    if (filter.status) where.status = filter.status;
    return where;
  }

  findMany(filter: FaqFilter, options: { skip: number; take: number }) {
    return this.prisma.faq.findMany({
      where: this.buildWhere(filter),
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
      skip: options.skip,
      take: options.take,
    });
  }

  count(filter: FaqFilter) {
    return this.prisma.faq.count({ where: this.buildWhere(filter) });
  }

  findById(id: any) {
    return this.prisma.faq.findUnique({ where: { id: toPrimaryKey(id) } });
  }

  findActiveById(id: any) {
    return this.prisma.faq.findFirst({
      where: { id: toPrimaryKey(id), status: BasicStatus.active },
    });
  }

  create(data: Record<string, any>) {
    return this.prisma.faq.create({
      data: data as Prisma.FaqUncheckedCreateInput,
    });
  }

  update(id: any, data: Prisma.FaqUncheckedUpdateInput) {
    return this.prisma.faq.update({ where: { id: toPrimaryKey(id) }, data });
  }

  delete(id: any) {
    return this.prisma.faq.delete({ where: { id: toPrimaryKey(id) } });
  }
}
