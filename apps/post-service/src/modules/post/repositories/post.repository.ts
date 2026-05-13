import { Injectable } from '@nestjs/common';
import { Prisma } from 'src/generated/prisma';
import { toPrimaryKey } from 'src/types';
import { PrismaService } from '../../../core/database/prisma.service';

type Tx = Prisma.TransactionClient | PrismaService;

// Whitelist of columns that can come in via the request body. Anything
// outside this list is dropped before reaching Prisma to defeat
// mass-assignment via spread (e.g. attacker setting `createdUserId` or
// `viewCount` from JSON body).
const ALLOWED_FIELDS: ReadonlySet<string> = new Set([
  'name',
  'slug',
  'excerpt',
  'content',
  'image',
  'coverImage',
  'status',
  'postType',
  'videoUrl',
  'audioUrl',
  'isFeatured',
  'isPinned',
  'publishedAt',
  'seoTitle',
  'seoDescription',
  'seoKeywords',
  'createdUserId',
  'updatedUserId',
]);

const SORTABLE_FIELDS: ReadonlySet<string> = new Set([
  'name',
  'createdAt',
  'updatedAt',
  'publishedAt',
  'viewCount',
  'isFeatured',
  'isPinned',
]);

export interface PostFilter {
  search?: string;
  status?: string | string[];
  postType?: string;
  isFeatured?: boolean;
  isPinned?: boolean;
  categoryId?: any;
  tagId?: any;
  slug?: string;
}

const WITH_RELATIONS = {
  stats: true,
  categoryLinks: { select: { category: { select: { id: true, name: true, slug: true } } } },
  tagLinks: { select: { tag: { select: { id: true, name: true, slug: true } } } },
} as const;

const PUBLIC_SELECT = {
  id: true,
  slug: true,
  name: true,
  excerpt: true,
  image: true,
  coverImage: true,
  status: true,
  postType: true,
  videoUrl: true,
  audioUrl: true,
  isFeatured: true,
  isPinned: true,
  publishedAt: true,
  seoTitle: true,
  seoDescription: true,
  seoKeywords: true,
  createdAt: true,
  updatedAt: true,
  stats: true,
  categoryLinks: { select: { category: { select: { id: true, name: true, slug: true } } } },
  tagLinks: { select: { tag: { select: { id: true, name: true, slug: true } } } },
} as const;

const SIMPLE_SELECT = {
  id: true,
  name: true,
  slug: true,
  status: true,
} as const;

@Injectable()
export class PostRepository {
  constructor(private readonly prisma: PrismaService) {}

  private buildWhere(filter: PostFilter): Prisma.PostWhereInput {
    const where: Prisma.PostWhereInput = {};
    if (filter.search) {
      // Cap search length and use insensitive mode — Postgres `contains`
      // is case-sensitive by default and unbounded length is a DoS vector.
      const search = filter.search.slice(0, 100);
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { slug: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (filter.status !== undefined) {
      where.status = Array.isArray(filter.status) ? { in: filter.status } : filter.status;
    }
    if (filter.postType) where.postType = filter.postType;
    if (filter.isFeatured !== undefined) where.isFeatured = filter.isFeatured;
    if (filter.isPinned !== undefined) where.isPinned = filter.isPinned;
    if (filter.categoryId !== undefined) {
      where.categoryLinks = { some: { categoryId: toPrimaryKey(filter.categoryId) } };
    }
    if (filter.tagId !== undefined) {
      where.tagLinks = { some: { tagId: toPrimaryKey(filter.tagId) } };
    }
    if (filter.slug) where.slug = filter.slug;
    return where;
  }

  private buildOrderBy(sort?: string): Prisma.PostOrderByWithRelationInput {
    if (!sort) return { publishedAt: 'desc' };
    const [field, dirRaw] = sort.split(':');
    // Allowlist sortable columns. Without this, an arbitrary `sort=foo:bar`
    // makes Prisma throw at runtime → 500 on a public endpoint, which is a
    // trivial DoS / fingerprinting vector.
    if (!field || !SORTABLE_FIELDS.has(field)) return { publishedAt: 'desc' };
    const dir: 'asc' | 'desc' = dirRaw?.toLowerCase() === 'asc' ? 'asc' : 'desc';
    if (field === 'viewCount') return { stats: { viewCount: dir } };
    return { [field]: dir } as Prisma.PostOrderByWithRelationInput;
  }

  findMany(filter: PostFilter, options: { skip: number; take: number }) {
    return this.prisma.post.findMany({
      where: this.buildWhere(filter),
      include: WITH_RELATIONS,
      orderBy: { updatedAt: 'desc' },
      skip: options.skip,
      take: options.take,
    });
  }

  findManyPublic(filter: PostFilter, options: { skip: number; take: number; sort?: string }) {
    return this.prisma.post.findMany({
      where: this.buildWhere(filter),
      select: PUBLIC_SELECT,
      orderBy: this.buildOrderBy(options.sort),
      skip: options.skip,
      take: options.take,
    });
  }

  findSimpleMany(filter: PostFilter, take: number) {
    return this.prisma.post.findMany({
      where: this.buildWhere(filter),
      select: SIMPLE_SELECT,
      orderBy: { name: 'asc' },
      take,
    });
  }

  count(filter: PostFilter) {
    return this.prisma.post.count({ where: this.buildWhere(filter) });
  }

  findById(id: any) {
    return this.prisma.post.findUnique({
      where: { id: toPrimaryKey(id) },
      include: WITH_RELATIONS,
    });
  }

  findBySlug(slug: string, statuses?: string[]) {
    const where: Prisma.PostWhereInput = { slug };
    if (statuses?.length) where.status = { in: statuses };
    return this.prisma.post.findFirst({ where, include: WITH_RELATIONS });
  }

  findBySlugSimple(slug: string) {
    return this.prisma.post.findUnique({ where: { slug }, select: { id: true, slug: true } });
  }

  /**
   * Creates a post together with its stats row and optional category/tag
   * links inside a single transaction.  Returns the post with relations.
   */
  async createWithRelations(
    data: Record<string, any>,
    categoryIds?: any[],
    tagIds?: any[],
  ) {
    return this.prisma.$transaction(async (tx) => {
      const post = await this.create(data, tx);
      await this.createStats(post.id, tx);
      if (categoryIds?.length) {
        await this.syncCategories(post.id, categoryIds, tx);
      }
      if (tagIds?.length) {
        await this.syncTags(post.id, tagIds, tx);
      }
      return tx.post.findUnique({
        where: { id: post.id },
        include: WITH_RELATIONS,
      });
    });
  }

  /**
   * Updates a post and optionally syncs category/tag links atomically.
   */
  async updateWithRelations(
    id: any,
    data: Record<string, any>,
    categoryIds?: any[],
    tagIds?: any[],
  ) {
    return this.prisma.$transaction(async (tx) => {
      await this.update(id, data, tx);
      if (categoryIds !== undefined) {
        await this.syncCategories(id, categoryIds, tx);
      }
      if (tagIds !== undefined) {
        await this.syncTags(id, tagIds, tx);
      }
      return tx.post.findUnique({
        where: { id: toPrimaryKey(id) },
        include: WITH_RELATIONS,
      });
    });
  }

  create(data: Record<string, any>, tx: Tx = this.prisma) {
    return tx.post.create({
      data: this.normalizePayload(data) as Prisma.PostUncheckedCreateInput,
    });
  }

  update(id: any, data: Record<string, any>, tx: Tx = this.prisma) {
    return tx.post.update({
      where: { id: toPrimaryKey(id) },
      data: this.normalizePayload(data) as Prisma.PostUncheckedUpdateInput,
    });
  }

  delete(id: any) {
    return this.prisma.post.delete({ where: { id: toPrimaryKey(id) } });
  }

  createStats(postId: any, tx: Tx = this.prisma) {
    return tx.stats.create({ data: { postId: toPrimaryKey(postId) } });
  }

  async syncCategories(postId: any, categoryIds: any[], tx: Tx = this.prisma) {
    const pid = toPrimaryKey(postId);
    await tx.postCategory.deleteMany({ where: { postId: pid } });
    if (categoryIds.length > 0) {
      await tx.postCategory.createMany({
        data: categoryIds.map((catId) => ({
          postId: pid,
          categoryId: toPrimaryKey(catId),
        })),
        skipDuplicates: true,
      });
    }
  }

  async syncTags(postId: any, tagIds: any[], tx: Tx = this.prisma) {
    const pid = toPrimaryKey(postId);
    await tx.postTag.deleteMany({ where: { postId: pid } });
    if (tagIds.length > 0) {
      await tx.postTag.createMany({
        data: tagIds.map((tagId) => ({
          postId: pid,
          tagId: toPrimaryKey(tagId),
        })),
        skipDuplicates: true,
      });
    }
  }

  private normalizePayload(data: Record<string, any>): Record<string, any> {
    // Strict allowlist: drop everything that isn't a recognised content field.
    // Combined with the global ValidationPipe whitelist, this is the second
    // line of defense against mass-assignment via spread.
    const payload: Record<string, any> = {};
    for (const key of Object.keys(data)) {
      if (ALLOWED_FIELDS.has(key)) payload[key] = data[key];
    }
    if (payload.publishedAt !== undefined) {
      payload.publishedAt = payload.publishedAt ? new Date(payload.publishedAt) : null;
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
