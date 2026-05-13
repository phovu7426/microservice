import { Injectable } from '@nestjs/common';
import { Prisma } from 'src/generated/prisma';
import { toPrimaryKey } from 'src/types';
import { PrismaService } from '../../../core/database/prisma.service';

export interface BannerFilter {
  search?: string;
  status?: string;
  locationId?: any;
  locationCode?: string;
  activeAt?: Date;
}

// Allowlist: defeat mass-assignment via spread on update path. The
// controller passes UpdateBannerDto = PartialType(CreateBannerDto)
// straight in; without this allowlist any future column added to
// schema (e.g. `view_count`) becomes client-controllable.
const ALLOWED_FIELDS: ReadonlySet<string> = new Set([
  'title',
  'subtitle',
  'image',
  'mobileImage',
  'link',
  'linkTarget',
  'description',
  'buttonText',
  'buttonColor',
  'textColor',
  'locationId',
  'sortOrder',
  'status',
  'startDate',
  'endDate',
]);

const SORTABLE_FIELDS: ReadonlySet<string> = new Set([
  'sortOrder',
  'createdAt',
  'updatedAt',
  'title',
  'status',
]);

const PUBLIC_INCLUDE = {
  location: { select: { id: true, code: true, name: true } },
} as const;

@Injectable()
export class BannerRepository {
  constructor(private readonly prisma: PrismaService) {}

  private buildWhere(filter: BannerFilter): Prisma.BannerWhereInput {
    const where: Prisma.BannerWhereInput = {};
    if (filter.search) {
      const search = filter.search.slice(0, 100);
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { subtitle: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (filter.status) where.status = filter.status;
    if (filter.locationId !== undefined) where.locationId = toPrimaryKey(filter.locationId);
    if (filter.locationCode) where.location = { code: filter.locationCode };
    if (filter.activeAt) {
      where.AND = [
        { OR: [{ startDate: null }, { startDate: { lte: filter.activeAt } }] },
        { OR: [{ endDate: null }, { endDate: { gte: filter.activeAt } }] },
      ];
    }
    return where;
  }

  private buildOrderBy(sort?: string): Prisma.BannerOrderByWithRelationInput[] {
    if (!sort) return [{ sortOrder: 'asc' }, { id: 'asc' }];
    const [field, dirRaw] = sort.split(':');
    if (!field || !SORTABLE_FIELDS.has(field)) return [{ sortOrder: 'asc' }, { id: 'asc' }];
    const dir: 'asc' | 'desc' = dirRaw?.toLowerCase() === 'asc' ? 'asc' : 'desc';
    return [{ [field]: dir } as Prisma.BannerOrderByWithRelationInput, { id: 'asc' }];
  }

  findMany(filter: BannerFilter, options: { skip: number; take: number; sort?: string }) {
    return this.prisma.banner.findMany({
      where: this.buildWhere(filter),
      include: { location: true },
      orderBy: this.buildOrderBy(options.sort),
      skip: options.skip,
      take: options.take,
    });
  }

  findManyPublic(filter: BannerFilter, options: { skip: number; take: number; sort?: string }) {
    return this.prisma.banner.findMany({
      where: this.buildWhere(filter),
      include: PUBLIC_INCLUDE,
      orderBy: this.buildOrderBy(options.sort),
      skip: options.skip,
      take: options.take,
    });
  }

  count(filter: BannerFilter) {
    return this.prisma.banner.count({ where: this.buildWhere(filter) });
  }

  findById(id: any) {
    return this.prisma.banner.findUnique({
      where: { id: toPrimaryKey(id) },
      include: { location: true },
    });
  }

  create(data: Record<string, any>) {
    return this.prisma.banner.create({
      data: this.normalizePayload(data) as Prisma.BannerUncheckedCreateInput,
    });
  }

  update(id: any, data: Record<string, any>) {
    return this.prisma.banner.update({
      where: { id: toPrimaryKey(id) },
      data: this.normalizePayload(data) as Prisma.BannerUncheckedUpdateInput,
    });
  }

  delete(id: any) {
    return this.prisma.banner.delete({ where: { id: toPrimaryKey(id) } });
  }

  private normalizePayload(data: Record<string, any>): Record<string, any> {
    const payload: Record<string, any> = {};
    for (const key of Object.keys(data)) {
      if (ALLOWED_FIELDS.has(key)) payload[key] = data[key];
    }
    if (payload.locationId !== undefined && payload.locationId !== null) {
      payload.locationId = toPrimaryKey(payload.locationId);
    }
    if (payload.startDate !== undefined && payload.startDate !== null) {
      payload.startDate = new Date(payload.startDate);
    }
    if (payload.endDate !== undefined && payload.endDate !== null) {
      payload.endDate = new Date(payload.endDate);
    }
    return payload;
  }
}
