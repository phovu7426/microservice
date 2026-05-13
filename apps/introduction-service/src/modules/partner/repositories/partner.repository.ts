import { Injectable } from '@nestjs/common';
import { Prisma } from 'src/generated/prisma';
import { toPrimaryKey } from 'src/types';
import { PrismaService } from '../../../core/database/prisma.service';
import { BasicStatus } from '../../../common/enums/status.enum';

export interface PartnerFilter {
  search?: string;
  status?: string;
  type?: string;
}

@Injectable()
export class PartnerRepository {
  constructor(private readonly prisma: PrismaService) {}

  private buildWhere(filter: PartnerFilter): Prisma.PartnerWhereInput {
    const where: Prisma.PartnerWhereInput = {};
    if (filter.search) {
      where.OR = [
        { name: { contains: filter.search.slice(0, 100), mode: 'insensitive' } },
        { description: { contains: filter.search.slice(0, 100), mode: 'insensitive' } },
      ];
    }
    if (filter.status) where.status = filter.status;
    if (filter.type) where.type = filter.type;
    return where;
  }

  findMany(filter: PartnerFilter, options: { skip: number; take: number }) {
    return this.prisma.partner.findMany({
      where: this.buildWhere(filter),
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
      skip: options.skip,
      take: options.take,
    });
  }

  count(filter: PartnerFilter) {
    return this.prisma.partner.count({ where: this.buildWhere(filter) });
  }

  findById(id: any) {
    return this.prisma.partner.findUnique({ where: { id: toPrimaryKey(id) } });
  }

  findActiveById(id: any) {
    return this.prisma.partner.findFirst({
      where: { id: toPrimaryKey(id), status: BasicStatus.active },
    });
  }

  create(data: Record<string, any>) {
    return this.prisma.partner.create({
      data: data as Prisma.PartnerUncheckedCreateInput,
    });
  }

  update(id: any, data: Record<string, any>) {
    return this.prisma.partner.update({
      where: { id: toPrimaryKey(id) },
      data: data as Prisma.PartnerUncheckedUpdateInput,
    });
  }

  delete(id: any) {
    return this.prisma.partner.delete({ where: { id: toPrimaryKey(id) } });
  }
}
