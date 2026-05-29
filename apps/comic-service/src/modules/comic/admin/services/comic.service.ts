import { BadRequestException, Injectable, Logger, NotFoundException, Optional } from '@nestjs/common';
import { Prisma } from 'src/generated/prisma';
import { PrimaryKey } from 'src/types';
import { RedisService } from '@package/redis';
import { I18nService } from 'nestjs-i18n';
import { CreateComicDto } from '../dtos/create-comic.dto';
import { UpdateComicDto } from '../dtos/update-comic.dto';
import { SlugHelper, t, createPaginationMeta, parseQueryOptions } from '@package/common';
import { ComicFilter, ComicRepository } from '../../repositories/comic.repository';

@Injectable()
export class AdminComicService {
  private readonly logger = new Logger(AdminComicService.name);

  constructor(
    private readonly comicRepo: ComicRepository,
    private readonly i18n: I18nService,
    @Optional() private readonly redis?: RedisService,
  ) {}

  async getList(query: any = {}) {
    const options = parseQueryOptions(query);

    const filter = this.buildFilter(query);

    const skipCount = query.skipCount === true || query.skipCount === 'true';
    const [data, total] = await Promise.all([
      this.comicRepo.findMany(filter, options),
      skipCount ? Promise.resolve(0) : this.comicRepo.count(filter),
    ]);

    return {
      data: data.map((c) => this.transform(c)),
      meta: createPaginationMeta(options, total),
    };
  }

  async getSimpleList(query: any = {}) {
    const limit = Math.min(Math.max(Number(query.limit) || 50, 1), 200);
    const filter = this.buildFilter(query);
    const data = await this.comicRepo.findSimpleMany(filter, limit);
    return { data };
  }

  async getOne(id: PrimaryKey) {
    const comic = await this.comicRepo.findById(id);
    if (!comic) throw new NotFoundException(t(this.i18n, 'comic.NOT_FOUND'));
    return this.transform(comic);
  }

  /**
   * Transactional create: comic + Stats + categoryLinks land atomically.
   * Previously these were 3 separate Prisma calls; a crash between them
   * left orphans. The slug pre-check also raced with concurrent creates
   * and surfaced raw `P2002` to the client — now caught and translated to
   * 400 with one retry on the unique-slug collision.
   */
  async create(dto: CreateComicDto, actorId?: PrimaryKey) {
    let attempt = 0;
    while (true) {
      const slug = await SlugHelper.uniqueSlug(dto.title, {
        findOne: (filter: any) => this.comicRepo.findBySlugSimple(filter.slug),
      });

      try {
        const created = await this.comicRepo.createWithRelations(
          { ...dto, slug, createdUserId: actorId, updatedUserId: actorId },
          dto.categoryIds,
        );
        await this.clearComicCaches(slug);
        return this.transform(created);
      } catch (err: any) {
        if (
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === 'P2002' &&
          attempt < 2
        ) {
          attempt++;
          continue;
        }
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
          throw new BadRequestException(t(this.i18n, 'comic.SLUG_IN_USE'));
        }
        throw err;
      }
    }
  }

  async update(id: PrimaryKey, dto: UpdateComicDto, actorId?: PrimaryKey) {
    const current = await this.getOne(id);

    const data: Record<string, any> = { ...dto };
    // Only regenerate slug when title actually changed AND no explicit
    // slug was supplied — previously every update with `title` silently
    // rewrote the slug even on rename-to-self.
    const titleChanged = dto.title !== undefined && dto.title !== (current as any).title;
    if (dto.slug || titleChanged) {
      data.slug = await SlugHelper.uniqueSlug(
        dto.slug || dto.title || '',
        { findOne: (filter: any) => this.comicRepo.findBySlugSimple(filter.slug) },
        id,
      );
    }

    if (actorId) data.updatedUserId = actorId;

    let updated: any;
    try {
      updated = await this.comicRepo.updateWithRelations(id, data, dto.categoryIds);
    } catch (err: any) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new BadRequestException(t(this.i18n, 'comic.SLUG_IN_USE'));
      }
      throw err;
    }

    await this.clearComicCaches(updated.slug || (current as any).slug);
    return this.transform(updated);
  }

  async delete(id: PrimaryKey) {
    const comic = await this.getOne(id);
    await this.comicRepo.delete(id);
    await this.clearComicCaches((comic as any).slug);
    return { success: true };
  }

  private async clearComicCaches(slug?: string): Promise<void> {
    try {
      if (slug) {
        await this.redis?.del(`comic:public:detail:${slug}`);
      }
      // Increment the list version so all old list cache keys become stale.
      // Old keys expire naturally via their TTL (60s). No SCAN needed.
      await this.redis?.incr('comic:public:list:v');
    } catch (err: any) {
      this.logger.warn('Failed to clear comic caches', (err as Error).message);
    }
  }

  private buildFilter(query: any): ComicFilter {
    const filter: ComicFilter = {};
    if (query.search) filter.search = query.search;
    if (query.status) filter.status = query.status;
    if (query.author) filter.author = query.author;
    if (query.isFeatured !== undefined) {
      filter.isFeatured = query.isFeatured === 'true' || query.isFeatured === true;
    }
    if (query.categoryId) filter.categoryId = query.categoryId;
    return filter;
  }

  private transform(entity: any) {
    if (!entity) return null;
    const item = { ...entity };
    if (Array.isArray(item.categoryLinks)) {
      item.categories = item.categoryLinks.map((l: any) => l?.category).filter(Boolean);
      item.category_ids = item.categories.map((c: any) => c.id);
      delete item.categoryLinks;
    }
    return item;
  }
}
