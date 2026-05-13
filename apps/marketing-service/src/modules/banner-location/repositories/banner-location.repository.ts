import { Injectable } from '@nestjs/common';
import { Prisma } from 'src/generated/prisma';
import { toPrimaryKey } from 'src/types';
import { PrismaService } from '../../../core/database/prisma.service';

export interface BannerLocationFilter {
  search?: string;
  status?: string;
  code?: string;
}

const ALLOWED_FIELDS: ReadonlySet<string> = new Set([
  'code',
  'name',
  'description',
  'status',
]);

const SORTABLE_FIELDS: ReadonlySet<string> = new Set([
  'name',
  'code',
  'createdAt',
  'updatedAt',
  'status',
]);

@Injectable()
export class BannerLocationRepository {
  constructor(private readonly prisma: PrismaService) {}

  private buildWhere(filter: BannerLocationFilter): Prisma.BannerLocationWhereInput {
    const where: Prisma.BannerLocationWhereInput = {};
    if (filter.search) {
      where.OR = [
        { name: { contains: filter.search } },
        { code: { contains: filter.search } },
      ];
    }
    if (filter.status) where.status = filter.status;
    if (filter.code) where.code = filter.code;
    return where;
  }

  private buildOrderBy(sort?: string): Prisma.BannerLocationOrderByWithRelationInput {
    if (!sort) return { createdAt: 'desc' };
    const [field, dirRaw] = sort.split(':');
    if (!field || !SORTABLE_FIELDS.has(field)) return { createdAt: 'desc' };
    const dir: 'asc' | 'desc' = dirRaw?.toLowerCase() === 'asc' ? 'asc' : 'desc';
    return { [field]: dir } as Prisma.BannerLocationOrderByWithRelationInput;
  }

  findMany(filter: BannerLocationFilter, options: { skip: number; take: number; sort?: string }) {
    return this.prisma.bannerLocation.findMany({
      where: this.buildWhere(filter),
      orderBy: this.buildOrderBy(options.sort),
      skip: options.skip,
      take: options.take,
    });
  }

  count(filter: BannerLocationFilter) {
    return this.prisma.bannerLocation.count({ where: this.buildWhere(filter) });
  }

  findById(id: any) {
    return this.prisma.bannerLocation.findUnique({
      where: { id: toPrimaryKey(id) },
      include: { banners: true },
    });
  }

  findByCode(code: string) {
    return this.prisma.bannerLocation.findUnique({ where: { code } });
  }

  findCodeConflict(code: string, excludeId: any) {
    return this.prisma.bannerLocation.findFirst({
      where: { code, NOT: { id: toPrimaryKey(excludeId) } },
    });
  }

  countBanners(locationId: any) {
    return this.prisma.banner.count({ where: { locationId: toPrimaryKey(locationId) } });
  }

  create(data: Record<string, any>) {
    return this.prisma.bannerLocation.create({
      data: this.normalizePayload(data) as Prisma.BannerLocationUncheckedCreateInput,
    });
  }

  update(id: any, data: Record<string, any>) {
    return this.prisma.bannerLocation.update({
      where: { id: toPrimaryKey(id) },
      data: this.normalizePayload(data) as Prisma.BannerLocationUncheckedUpdateInput,
    });
  }

  delete(id: any) {
    return this.prisma.bannerLocation.delete({ where: { id: toPrimaryKey(id) } });
  }

  private normalizePayload(data: Record<string, any>): Record<string, any> {
    const payload: Record<string, any> = {};
    for (const key of Object.keys(data)) {
      if (ALLOWED_FIELDS.has(key)) payload[key] = data[key];
    }
    return payload;
  }
}
