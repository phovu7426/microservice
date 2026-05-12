import { Injectable, NotFoundException } from '@nestjs/common';
import { RedisService } from '@package/redis';
import { I18nService } from 'nestjs-i18n';
import { t, createPaginationMeta, parseQueryOptions } from '@package/common';
import { PUBLIC_COMIC_STATUSES } from '../../enums/comic-status.enum';
import { ComicFilter, ComicRepository } from '../../repositories/comic.repository';

const LIST_KEYS = ['search', 'is_featured', 'comic_category_id', 'category_id', 'sort', 'page', 'limit'];
const CHAPTER_KEYS = ['search', 'sort', 'page', 'limit'];

@Injectable()
export class PublicComicService {
  private readonly inflight = new Map<string, Promise<any>>();

  constructor(
    private readonly comicRepo: ComicRepository,
    private readonly i18n: I18nService,
    private readonly redis: RedisService,
  ) {}

  async getList(query: any = {}) {
    const version = await this.getVersion('comic:public:list:v');
    const cacheKey = `comic:public:list:${version}:${this.hashQuery(query, LIST_KEYS)}`;

    return this.getOrSet(cacheKey, 60, async () => {
      const options = parseQueryOptions(query);

      const filter: ComicFilter = { status: PUBLIC_COMIC_STATUSES };
      if (query.search) filter.search = query.search;
      if (query.is_featured !== undefined) {
        filter.is_featured = query.is_featured === 'true' || query.is_featured === true;
      }
      if (query.comic_category_id || query.category_id) {
        filter.category_id = query.comic_category_id ?? query.category_id;
      }

      const [data, total] = await Promise.all([
        this.comicRepo.findManyPublic(filter, { ...options, sort: query.sort }),
        this.comicRepo.count(filter),
      ]);

      return {
        data: data.map((c) => this.transform(c)),
        meta: createPaginationMeta(options, total),
      };
    });
  }

  async getBySlug(slug: string) {
    const cacheKey = `comic:public:detail:${slug}`;

    return this.getOrSet(cacheKey, 120, async () => {
      const comic = await this.comicRepo.findBySlug(slug, PUBLIC_COMIC_STATUSES);
      if (!comic) throw new NotFoundException(t(this.i18n, 'comic.NOT_FOUND'));
      return this.transform(comic);
    });
  }

  async getChaptersBySlug(slug: string, query: any = {}, requesterKey?: string) {
    const comic = await this.comicRepo.findIdBySlug(slug, PUBLIC_COMIC_STATUSES);
    if (!comic) throw new NotFoundException(t(this.i18n, 'comic.NOT_FOUND'));

    // View-counter dedup: use a per-day HyperLogLog per comic so each unique
    // requester (user id or IP) is counted at most once per calendar day.
    // HLL uses ~12 KB/key regardless of cardinality, far cheaper than one
    // setnx key per (comic, requester) pair. Keys auto-expire after 48 h.
    if (this.redis.isEnabled() && requesterKey) {
      const today = new Date().toISOString().slice(0, 10);
      const hllKey = `comic:views:hll:${comic.id}:${today}`;
      const isNew = await this.redis.pfadd(hllKey, requesterKey);
      if (isNew) {
        await Promise.all([
          this.redis.hincrby('comic:views:buffer', comic.id.toString(), 1),
          this.redis.expire(hllKey, 172800),
        ]);
      }
    }

    const chaptersVersion = await this.getVersion('comic:public:chapters:v');
    const cacheKey = `comic:public:chapters:${chaptersVersion}:${slug}:${this.hashQuery(query, CHAPTER_KEYS)}`;

    return this.getOrSet(cacheKey, 60, async () => {
      // Hard cap chapter list at 200 per page (was effectively unbounded with
      // `limit: query.limit ?? 10000` — trivial DoS).
      const options = parseQueryOptions(query, { defaultTake: 50, maxTake: 200 });

      const [data, total] = await Promise.all([
        this.comicRepo.findPublicChapters(comic.id, options),
        this.comicRepo.countPublicChapters(comic.id),
      ]);

      return { data, meta: createPaginationMeta(options, total) };
    });
  }

  private transform(entity: any) {
    if (!entity) return null;
    const item = { ...entity };

    if (Array.isArray(item.categoryLinks)) {
      item.categories = item.categoryLinks.map((l: any) => l?.category).filter(Boolean);
      delete item.categoryLinks;
    }

    if (Array.isArray(item.chapters)) {
      const last = item.chapters[0];
      if (last) {
        item.last_chapter = {
          id: last.id,
          title: last.title,
          chapter_index: last.chapter_index,
          chapter_label: last.chapter_label,
          created_at: last.created_at,
        };
      }
      delete item.chapters;
    }

    return item;
  }

  private async getVersion(key: string): Promise<string> {
    try {
      if (this.redis.isEnabled()) {
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
    // Check cache first
    try {
      if (this.redis.isEnabled()) {
        const raw = await this.redis.get(key);
        if (raw) return JSON.parse(raw);
      }
    } catch {}

    // Single-flight: if another request is already loading this key, wait for it
    const existing = this.inflight.get(key);
    if (existing) return existing as Promise<T>;

    const promise = factory().then(async (result) => {
      try {
        if (this.redis.isEnabled()) {
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

    if (this.inflight.size >= 1000) {
      // Evict oldest 25% instead of clearing all — prevents thundering herd
      const evictCount = 250;
      const keys = this.inflight.keys();
      for (let i = 0; i < evictCount; i++) {
        const next = keys.next();
        if (next.done) break;
        this.inflight.delete(next.value);
      }
    }
    this.inflight.set(key, promise);
    return promise;
  }
}
