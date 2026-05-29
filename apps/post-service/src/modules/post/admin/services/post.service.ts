import { BadRequestException, Injectable, Logger, NotFoundException, Optional } from '@nestjs/common';
import { Prisma } from 'src/generated/prisma';
import { I18nService } from 'nestjs-i18n';
import { RedisService } from '@package/redis';
import { CreatePostDto } from '../dtos/create-post.dto';
import { UpdatePostDto } from '../dtos/update-post.dto';
import { SlugHelper, t, createPaginationMeta, parseQueryOptions } from '@package/common';
import { PrimaryKey } from 'src/types';
import { PostFilter, PostRepository } from '../../repositories/post.repository';

@Injectable()
export class AdminPostService {
  private readonly logger = new Logger(AdminPostService.name);

  constructor(
    private readonly postRepo: PostRepository,
    private readonly i18n: I18nService,
    @Optional() private readonly redis?: RedisService,
  ) {}

  async getList(query: any = {}) {
    const options = parseQueryOptions(query);

    const filter = this.buildFilter(query);

    const skipCount = query.skipCount === true || query.skipCount === 'true';
    const [data, total] = await Promise.all([
      this.postRepo.findMany(filter, options),
      skipCount ? Promise.resolve(0) : this.postRepo.count(filter),
    ]);

    return {
      data: data.map((p) => this.transform(p)),
      meta: createPaginationMeta(options, total),
    };
  }

  async getSimpleList(query: any = {}) {
    const limit = Math.min(Math.max(Number(query.limit) || 50, 1), 200);
    const filter = this.buildFilter(query);
    const data = await this.postRepo.findSimpleMany(filter, limit);
    return { data };
  }

  async getOne(id: PrimaryKey) {
    const post = await this.postRepo.findById(id);
    if (!post) throw new NotFoundException(t(this.i18n, 'post.POST_NOT_FOUND'));
    return this.transform(post);
  }

  /**
   * Creates the post + Stats row + category/tag links atomically.
   *
   * Previously these were 4 separate Prisma calls. A crash between them
   * left orphans (post without stats, post without categories) in DB. The
   * slug pre-check also raced with concurrent creates and surfaced raw
   * `P2002` to the client — now caught and translated to 400 with retry.
   */
  async create(dto: CreatePostDto, actorId?: PrimaryKey) {
    let attempt = 0;
    while (true) {
      const slug = await SlugHelper.uniqueSlug(dto.name, {
        findOne: (filter: any) => this.postRepo.findBySlugSimple(filter.slug),
      });

      const data: Record<string, any> = { ...dto, slug };
      if (actorId) data.createdUserId = actorId;

      try {
        const post = await this.postRepo.createWithRelations(
          data,
          dto.categoryIds,
          dto.tagIds,
        );
        await this.clearPostCaches(slug);
        return this.transform(post);
      } catch (err: any) {
        if (
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === 'P2002' &&
          attempt < 2
        ) {
          // Concurrent create stole our slug — retry once with a fresh slug.
          attempt++;
          continue;
        }
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
          throw new BadRequestException(t(this.i18n, 'post.SLUG_ALREADY_IN_USE'));
        }
        throw err;
      }
    }
  }

  async update(id: PrimaryKey, dto: UpdatePostDto, actorId?: PrimaryKey) {
    const current = await this.getOne(id);

    const data: Record<string, any> = { ...dto };
    // Only regenerate slug when the name actually changed AND no explicit
    // slug was provided. Previously every update with `name` set rewrote
    // the slug even when the name was identical.
    const nameChanged = dto.name !== undefined && dto.name !== (current as any).name;
    if (dto.slug || nameChanged) {
      data.slug = await SlugHelper.uniqueSlug(
        dto.slug || dto.name || '',
        { findOne: (filter: any) => this.postRepo.findBySlugSimple(filter.slug) },
        id,
      );
    }
    if (actorId) data.updatedUserId = actorId;

    let updated: any;
    try {
      updated = await this.postRepo.updateWithRelations(id, data, dto.categoryIds, dto.tagIds);
    } catch (err: any) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new BadRequestException(t(this.i18n, 'post.SLUG_ALREADY_IN_USE'));
      }
      throw err;
    }

    const currentSlug = (current as any).slug;
    // If slug changed, invalidate the old detail cache too; otherwise stale
    // data is served for up to 120 s after the rename.
    if (data.slug && data.slug !== currentSlug) {
      await this.clearPostCaches(currentSlug);
    }
    await this.clearPostCaches(data.slug || currentSlug);
    return this.transform(updated);
  }

  async delete(id: PrimaryKey) {
    const post = await this.getOne(id);
    await this.postRepo.delete(id);
    await this.clearPostCaches((post as any).slug);
    return { success: true };
  }

  private async clearPostCaches(slug?: string): Promise<void> {
    try {
      if (slug) {
        await this.redis?.del(`post:public:detail:${slug}`);
      }
      // Increment the list version so all old list cache keys become stale.
      // Old keys expire naturally via their TTL (60s). No SCAN needed.
      await this.redis?.incr('post:public:list:v');
    } catch (err: any) {
      this.logger.warn('Failed to clear post caches', (err as Error).message);
    }
  }

  private buildFilter(query: any): PostFilter {
    const filter: PostFilter = {};
    if (query.search) filter.search = query.search;
    if (query.status) filter.status = query.status;
    if (query.postType) filter.postType = query.postType;
    if (query.isFeatured !== undefined) {
      filter.isFeatured = query.isFeatured === 'true' || query.isFeatured === true;
    }
    if (query.isPinned !== undefined) {
      filter.isPinned = query.isPinned === 'true' || query.isPinned === true;
    }
    if (query.categoryId) filter.categoryId = query.categoryId;
    if (query.tagId) filter.tagId = query.tagId;
    return filter;
  }

  private transform(entity: any) {
    if (!entity) return null;
    const item = { ...entity };
    if (Array.isArray(item.categoryLinks)) {
      item.categories = item.categoryLinks.map((l: any) => l?.category).filter(Boolean);
      item.categoryIds = item.categories.map((c: any) => c.id);
      delete item.categoryLinks;
    }
    if (Array.isArray(item.tagLinks)) {
      item.tags = item.tagLinks.map((l: any) => l?.tag).filter(Boolean);
      item.tagIds = item.tags.map((t: any) => t.id);
      delete item.tagLinks;
    }
    return item;
  }
}
