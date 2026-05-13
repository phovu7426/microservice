import { Injectable } from '@nestjs/common';
import { Prisma } from 'src/generated/prisma';
import { toPrimaryKey } from 'src/types';
import { PrismaService } from '../../../core/database/prisma.service';
import { BasicStatus } from '../../../common/enums/status.enum';

export interface GalleryFilter {
  search?: string;
  status?: string;
  featured?: boolean;
}

@Injectable()
export class GalleryRepository {
  constructor(private readonly prisma: PrismaService) {}

  private buildWhere(filter: GalleryFilter): Prisma.GalleryWhereInput {
    const where: Prisma.GalleryWhereInput = {};
    if (filter.search) {
      where.OR = [
        { title: { contains: filter.search.slice(0, 100), mode: 'insensitive' } },
        { slug: { contains: filter.search.slice(0, 100), mode: 'insensitive' } },
      ];
    }
    if (filter.status) where.status = filter.status;
    if (filter.featured !== undefined) where.featured = filter.featured;
    return where;
  }

  findMany(filter: GalleryFilter, options: { skip: number; take: number }) {
    return this.prisma.gallery.findMany({
      where: this.buildWhere(filter),
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
      skip: options.skip,
      take: options.take,
    });
  }

  count(filter: GalleryFilter) {
    return this.prisma.gallery.count({ where: this.buildWhere(filter) });
  }

  findById(id: any) {
    return this.prisma.gallery.findUnique({ where: { id: toPrimaryKey(id) } });
  }

  findBySlug(slug: string) {
    return this.prisma.gallery.findUnique({ where: { slug } });
  }

  findActiveBySlug(slug: string) {
    return this.prisma.gallery.findFirst({ where: { slug, status: BasicStatus.active } });
  }

  create(data: Record<string, any>) {
    return this.prisma.gallery.create({
      data: data as Prisma.GalleryUncheckedCreateInput,
    });
  }

  update(id: any, data: Record<string, any>) {
    return this.prisma.gallery.update({
      where: { id: toPrimaryKey(id) },
      data: data as Prisma.GalleryUncheckedUpdateInput,
    });
  }

  delete(id: any) {
    return this.prisma.gallery.delete({ where: { id: toPrimaryKey(id) } });
  }
}
