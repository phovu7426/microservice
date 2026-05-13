import { Injectable } from '@nestjs/common';
import { Prisma } from 'src/generated/prisma';
import { toPrimaryKey } from 'src/types';
import { PrismaService } from '../../../core/database/prisma.service';
import { ComicStatus } from '../enums/comic-status.enum';
import { ChapterStatus } from '../../chapter/enums/chapter-status.enum';

type Tx = Prisma.TransactionClient | PrismaService;

const ALLOWED_FIELDS: ReadonlySet<string> = new Set([
  'title',
  'slug',
  'description',
  'coverImage',
  'author',
  'status',
  'isFeatured',
  'createdUserId',
  'updatedUserId',
]);

const SORTABLE_TOP_LEVEL: ReadonlySet<string> = new Set([
  'title',
  'createdAt',
  'updatedAt',
  'lastChapterUpdatedAt',
  'isFeatured',
]);

const SORTABLE_STATS: ReadonlySet<string> = new Set([
  'viewCount',
  'followCount',
  'ratingCount',
  'ratingSum',
]);

export interface ComicFilter {
  search?: string;
  status?: string | string[];
  isFeatured?: boolean;
  categoryId?: any;
  author?: string;
  slug?: string;
}

const WITH_RELATIONS = {
  stats: true,
  categoryLinks: { select: { category: { select: { id: true, name: true, slug: true } } } },
} as const;

const PUBLIC_SELECT = {
  id: true,
  slug: true,
  title: true,
  description: true,
  coverImage: true,
  author: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  lastChapterId: true,
  lastChapterUpdatedAt: true,
  isFeatured: true,
  stats: true,
  categoryLinks: {
    select: { category: { select: { id: true, name: true, slug: true } } },
  },
  chapters: {
    where: { status: ChapterStatus.published },
    orderBy: { chapterIndex: 'desc' as const },
    take: 1,
    select: {
      id: true,
      title: true,
      chapterIndex: true,
      chapterLabel: true,
      createdAt: true,
    },
  },
} as const;

const SIMPLE_SELECT = {
  id: true,
  title: true,
  slug: true,
  status: true,
} as const;

@Injectable()
export class ComicRepository {
  constructor(private readonly prisma: PrismaService) {}

  private buildWhere(filter: ComicFilter): Prisma.ComicWhereInput {
    const where: Prisma.ComicWhereInput = {};
    if (filter.search) {
      // Cap search length and use insensitive mode — Postgres `contains`
      // is case-sensitive by default and unbounded length is a DoS vector.
      const search = filter.search.slice(0, 100);
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { slug: { contains: search, mode: 'insensitive' } },
        { author: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (filter.status !== undefined) {
      where.status = Array.isArray(filter.status) ? { in: filter.status } : filter.status;
    }
    if (filter.isFeatured !== undefined) where.isFeatured = filter.isFeatured;
    if (filter.author) where.author = filter.author;
    if (filter.slug) where.slug = filter.slug;
    if (filter.categoryId !== undefined) {
      where.categoryLinks = { some: { categoryId: toPrimaryKey(filter.categoryId) } };
    }
    return where;
  }

  private buildOrderBy(sort?: string): Prisma.ComicOrderByWithRelationInput {
    if (!sort) return { updatedAt: 'desc' };
    const [field, dirRaw] = sort.split(':');
    if (!field) return { updatedAt: 'desc' };
    const dir: 'asc' | 'desc' = dirRaw?.toLowerCase() === 'asc' ? 'asc' : 'desc';
    // Allowlist sortable columns. Without it `?sort=foo:bar` made Prisma
    // throw at runtime — 500 on a public endpoint, fingerprintable.
    if (SORTABLE_STATS.has(field)) {
      return { stats: { [field]: dir } } as Prisma.ComicOrderByWithRelationInput;
    }
    if (SORTABLE_TOP_LEVEL.has(field)) {
      return { [field]: dir } as Prisma.ComicOrderByWithRelationInput;
    }
    return { updatedAt: 'desc' };
  }

  findMany(filter: ComicFilter, options: { skip: number; take: number }) {
    return this.prisma.comic.findMany({
      where: this.buildWhere(filter),
      include: WITH_RELATIONS,
      orderBy: { updatedAt: 'desc' },
      skip: options.skip,
      take: options.take,
    });
  }

  findManyPublic(filter: ComicFilter, options: { skip: number; take: number; sort?: string }) {
    return this.prisma.comic.findMany({
      where: this.buildWhere(filter),
      select: PUBLIC_SELECT,
      orderBy: this.buildOrderBy(options.sort),
      skip: options.skip,
      take: options.take,
    });
  }

  findSimpleMany(filter: ComicFilter, take: number) {
    return this.prisma.comic.findMany({
      where: this.buildWhere(filter),
      select: SIMPLE_SELECT,
      orderBy: { title: 'asc' },
      take,
    });
  }

  count(filter: ComicFilter) {
    return this.prisma.comic.count({ where: this.buildWhere(filter) });
  }

  findById(id: any) {
    return this.prisma.comic.findUnique({
      where: { id: toPrimaryKey(id) },
      include: WITH_RELATIONS,
    });
  }

  findBySlug(slug: string, statuses?: string[]) {
    const where: Prisma.ComicWhereInput = { slug };
    if (statuses?.length) where.status = { in: statuses };
    return this.prisma.comic.findFirst({
      where,
      select: PUBLIC_SELECT,
    });
  }

  findIdBySlug(slug: string, statuses?: string[]) {
    const where: Prisma.ComicWhereInput = { slug };
    if (statuses?.length) where.status = { in: statuses };
    return this.prisma.comic.findFirst({ where, select: { id: true } });
  }

  findBySlugSimple(slug: string) {
    return this.prisma.comic.findUnique({ where: { slug }, select: { id: true, slug: true } });
  }

  async createWithRelations(
    data: Record<string, any>,
    categoryIds?: any[],
  ) {
    return this.prisma.$transaction(async (tx) => {
      const comic = await this.create(data, tx);
      await this.createStats(comic.id, tx);
      if (categoryIds?.length) {
        await this.syncCategories(comic.id, categoryIds, tx);
      }
      // Re-fetch within the same transaction so the caller gets the full
      // entity with relations — avoids an extra round-trip after commit.
      return tx.comic.findUnique({
        where: { id: comic.id },
        include: WITH_RELATIONS,
      });
    });
  }

  async updateWithRelations(
    id: any,
    data: Record<string, any>,
    categoryIds?: any[],
  ) {
    return this.prisma.$transaction(async (tx) => {
      await this.update(id, data, tx);
      if (categoryIds !== undefined) {
        await this.syncCategories(id, categoryIds, tx);
      }
      // Return the updated entity with relations inside the transaction
      // so the caller doesn't need a separate fetch after commit.
      return tx.comic.findUnique({
        where: { id: toPrimaryKey(id) },
        include: WITH_RELATIONS,
      });
    });
  }

  create(data: Record<string, any>, tx: Tx = this.prisma) {
    return tx.comic.create({
      data: this.normalizePayload(data) as Prisma.ComicUncheckedCreateInput,
    });
  }

  update(id: any, data: Record<string, any>, tx: Tx = this.prisma) {
    return tx.comic.update({
      where: { id: toPrimaryKey(id) },
      data: this.normalizePayload(data) as Prisma.ComicUncheckedUpdateInput,
    });
  }

  delete(id: any) {
    return this.prisma.comic.delete({ where: { id: toPrimaryKey(id) } });
  }

  createStats(comicId: any, tx: Tx = this.prisma) {
    return tx.stats.create({ data: { comicId: toPrimaryKey(comicId) } });
  }

  async syncCategories(comicId: any, categoryIds: any[], tx: Tx = this.prisma) {
    const cid = toPrimaryKey(comicId);
    await tx.comicCategory.deleteMany({ where: { comicId: cid } });
    if (categoryIds.length > 0) {
      await tx.comicCategory.createMany({
        data: categoryIds.map((catId) => ({
          comicId: cid,
          categoryId: toPrimaryKey(catId),
        })),
        skipDuplicates: true,
      });
    }
  }

  findPublicChapters(comicId: any, options: { skip: number; take: number }) {
    return this.prisma.chapter.findMany({
      where: { comicId: toPrimaryKey(comicId), status: ChapterStatus.published },
      select: {
        id: true,
        comicId: true,
        title: true,
        chapterIndex: true,
        chapterLabel: true,
        status: true,
        viewCount: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { chapterIndex: 'desc' },
      skip: options.skip,
      take: options.take,
    });
  }

  countPublicChapters(comicId: any) {
    return this.prisma.chapter.count({
      where: { comicId: toPrimaryKey(comicId), status: ChapterStatus.published },
    });
  }

  private normalizePayload(data: Record<string, any>): Record<string, any> {
    // Strict allowlist: drop everything outside ALLOWED_FIELDS. Defeats
    // mass-assignment via spread (e.g. attacker setting `viewCount` or
    // `lastChapterId` from JSON body).
    const payload: Record<string, any> = {};
    for (const key of Object.keys(data)) {
      if (ALLOWED_FIELDS.has(key)) payload[key] = data[key];
    }
    const bigIntFields = ['createdUserId', 'updatedUserId'];
    for (const field of bigIntFields) {
      const value = payload[field];
      if (value === undefined) continue;
      payload[field] = value === null || value === '' ? null : toPrimaryKey(value);
    }
    return payload;
  }
}
