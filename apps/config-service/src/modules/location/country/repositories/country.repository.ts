import { Injectable } from '@nestjs/common';
import { Prisma } from 'src/generated/prisma';
import { PrismaService } from '../../../../core/database/prisma.service';
import { toPrimaryKey } from '../../../../types';

export interface CountryFilter {
  name?: string;
  code?: string;
  status?: string;
}

@Injectable()
export class CountryRepository {
  constructor(private readonly prisma: PrismaService) {}

  private buildWhere(filter: CountryFilter): Prisma.CountryWhereInput {
    const where: Prisma.CountryWhereInput = {};
    if (filter.name) where.name = { contains: filter.name, mode: 'insensitive' };
    if (filter.code) where.code = filter.code;
    if (filter.status) where.status = filter.status;
    return where;
  }

  countProvinces(countryId: any) {
    return this.prisma.province.count({ where: { countryId: this.toBig(countryId) } });
  }

  private toBig(id: any): bigint {
    if (typeof id === 'bigint') return id;
    return BigInt(String(id));
  }

  findMany(filter: CountryFilter, options: { skip: number; take: number }) {
    return this.prisma.country.findMany({
      where: this.buildWhere(filter),
      skip: options.skip,
      take: options.take,
    });
  }

  count(filter: CountryFilter) {
    return this.prisma.country.count({ where: this.buildWhere(filter) });
  }

  findById(id: any) {
    return this.prisma.country.findUnique({ where: { id: toPrimaryKey(id) } });
  }

  create(data: Record<string, any>) {
    return this.prisma.country.create({ data: this.normalizePayload(data) as Prisma.CountryCreateInput });
  }

  update(id: any, data: Record<string, any>) {
    return this.prisma.country.update({
      where: { id: toPrimaryKey(id) },
      data: this.normalizePayload(data) as Prisma.CountryUpdateInput,
    });
  }

  delete(id: any) {
    return this.prisma.country.delete({ where: { id: toPrimaryKey(id) } });
  }

  private normalizePayload(data: Record<string, any>): Record<string, any> {
    const payload: any = { ...data };
    // DTO fields already match Prisma camelCase field names — no mapping needed
    return payload;
  }
}
