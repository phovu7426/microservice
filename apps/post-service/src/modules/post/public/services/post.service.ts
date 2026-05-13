import { Injectable, NotFoundException, Optional } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { RedisService } from '@package/redis';
import { t, createPaginationMeta, parseQueryOptions } from '@package/common';
import { PUBLIC_POST_STATUSES } from '../../enums/post-status.enum';
import { PostFilter, PostRepository } from '../../repositories/post.repository';

const LIST_KEYS = ['search', 'postType', 'isFeatured', 'isPinned', 'postCategoryId', 'categoryId', 'postTagId', 'tagId', 'sort', 'page', 'limit'];

@Injectable()
export class PublicPostService {
  private readonly inflight = new Map<string, Promise<any>>();

  constructor(
    private readonly postRepo: PostRepository,
    private readonly i18n: I18nService,
    @Optional() private readonly redis?: RedisService,
  ) {}

  async getList(query: any = {}) {
    const version = await this.getVersion('post:public:list:v');
    const cacheKey = `post:public:list:${version}:${this.hashQuery(query, LIST_KEYS)}`;

    return this.getOrSet(cacheKey, 60, async () => {
      const options = parseQueryOptions(query);

      const filter: PostFilter = { status: PUBLIC_POST_STATUSES };
      if (query.search) filter.search = query.search;
      if (query.postType) filter.postType = query.postType;
      if (query.isFeatured !== undefined) {
        filter.isFeatured = query.isFeatured === 'true' || query.isFeatured === true;
      }
      if (query.isPinned !== undefined) {
        filter.isPinned = query.isPinned === 'true' || query.isPinned === true;
      }
      if (query.postCategoryId || query.categoryId) {
        filter.categoryId = query.postCategoryId ?? query.categoryId;
      }
      if (query.postTagId || query.tagId) {
        filter.tagId = query.postTagId ?? query.tagId;
      }

      const [data, total] = await Promise.all([
        this.postRepo.findManyPublic(filter, { ...options, sort: query.sort }),
        this.postRepo.count(filter),
      ]);

      return {
        data: data.map((p) => this.transform(p)),
        meta: createPaginationMeta(options, total),
      };
    });
  }

  async getBySlug(slug: string, requesterKey?: string) {
    // View counting must happen outside getOrSet since it's per-request, not per-cache-miss
    const post = await this.postRepo.findBySlug(slug, PUBLIC_POST_STATUSES);
    if (!post) throw new NotFoundException(t(this.i18n, 'post.POST_NOT_FOUND'));

    if (this.redis?.isEnabled() && requesterKey) {
      const today = new Date().toISOString().slice(0, 10);
      const hllKey = `post:views:hll:${post.id}:${today}`;
      const isNew = await this.redis.pfadd(hllKey, requesterKey);
      if (isNew) {
        await Promise.all([
          this.redis.hincrby('post:views:buffer', post.id.toString(), 1),
          this.redis.expire(hllKey, 172800),
        ]);
      }
    }

    const cacheKey = `post:public:detail:${slug}`;

    return this.getOrSet(cacheKey, 120, async () => {
      return this.transform(post);
    });
  }

  private transform(entity: any) {
    if (!entity) return null;
    const item = { ...entity };
    if (Array.isArray(item.categoryLinks)) {
      item.categories = item.categoryLinks.map((l: any) => l?.category).filter(Boolean);
      delete item.categoryLinks;
    }
    if (Array.isArray(item.tagLinks)) {
      item.tags = item.tagLinks.map((l: any) => l?.tag).filter(Boolean);
      delete item.tagLinks;
    }
    return item;
  }

  private async getVersion(key: string): Promise<string> {
    try {
      if (this.redis?.isEnabled()) {
        return (await this.redis.get(key)) || '0';
      }
    } catch {}
    return '0';
  }

  private hashQuery(query: any, allowedKeys?: string[]): string {
    const src = allowedKeys
      ? Object.fromEntries(allowedKeys.filter((k) => query[k] !== undefined).map((k) => [k, query[k]]))
      : query;
    let stableStr = JSON.stringify(
      src,
      (_, v) => {
        if (v && typeof v === 'object' && !Array.isArray(v)) {
          return Object.keys(v).sort().reduce((o: any, k) => { o[k] = v[k]; return o; }, {});
        }
        return typeof v === 'bigint' ? Number(v) : v;
      },
    );
    if (stableStr.length > 512) stableStr = stableStr.slice(0, 512);
    let hash = 5381;
    for (let i = 0; i < stableStr.length; i++) hash = ((hash << 5) + hash + stableStr.charCodeAt(i)) | 0;
    return (hash >>> 0).toString(36);
  }

  private async getOrSet<T>(key: string, ttl: number, factory: () => Promise<T>): Promise<T> {
    try {
      if (this.redis?.isEnabled()) {
        const raw = await this.redis.get(key);
        if (raw) return JSON.parse(raw);
      }
    } catch {}

    const existing = this.inflight.get(key);
    if (existing) return existing as Promise<T>;

    const promise = factory().then(async (result) => {
      try {
        if (this.redis?.isEnabled()) {
          await this.redis.set(
            key,
            JSON.stringify(result, (_, v) => (typeof v === 'bigint' ? Number(v) : v)),
            ttl,
          );
        }
      } catch {}
      return result;
    }).finally(() => {
      this.inflight.delete(key);
    });

    if (this.inflight.size >= 1000) this.inflight.clear();
    this.inflight.set(key, promise);
    return promise;
  }
}
