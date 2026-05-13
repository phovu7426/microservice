import { Injectable } from '@nestjs/common';
import { Prisma } from 'src/generated/prisma';
import { PrismaService } from '../../../../core/database/prisma.service';
import { toPrimaryKey } from '../../../../types';

export interface WardFilter {
  name?: string;
  code?: string;
  status?: string;
  provinceId?: any;
}

@Injectable()
export class WardRepository {
  constructor(private readonly prisma: PrismaService) {}

  private buildWhere(filter: WardFilter): Prisma.WardWhereInput {
    const where: Prisma.WardWhereInput = {};
    if (filter.name) where.name = { contains: filter.name, mode: 'insensitive' };
    if (filter.code) where.code = filter.code;
    if (filter.status) where.status = filter.status;
    if (filter.provinceId !== undefined && filter.provinceId !== null) {
      where.provinceId = toPrimaryKey(filter.provinceId);
    }
    return where;
  }

  findMany(filter: WardFilter, options: { skip: number; take: number }) {
    return this.prisma.ward.findMany({
      where: this.buildWhere(filter),
      skip: options.skip,
      take: options.take,
    });
  }

  count(filter: WardFilter) {
    return this.prisma.ward.count({ where: this.buildWhere(filter) });
  }

  findById(id: any) {
    return this.prisma.ward.findUnique({ where: { id: toPrimaryKey(id) } });
  }

  create(data: Record<string, any>) {
    const payload = this.normalizePayload(data);
    return this.prisma.ward.create({ data: payload as Prisma.WardCreateInput });
  }

  update(id: any, data: Record<string, any>) {
    const payload = this.normalizePayload(data);
    return this.prisma.ward.update({
      where: { id: toPrimaryKey(id) },
      data: payload as Prisma.WardUpdateInput,
    });
  }

  delete(id: any) {
    return this.prisma.ward.delete({ where: { id: toPrimaryKey(id) } });
  }

  private normalizePayload(data: Record<string, any>): Record<string, any> {
    const payload: any = { ...data };

    // Convert BigInt fields
    if (payload.provinceId !== undefined && payload.provinceId !== null) {
      payload.provinceId = toPrimaryKey(payload.provinceId);
    }

    return payload;
  }
}
