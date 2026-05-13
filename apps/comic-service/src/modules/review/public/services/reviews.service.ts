import { Injectable, Optional } from '@nestjs/common';
import { RedisService } from '@package/redis';
import { createPaginationMeta, parseQueryOptions } from '@package/common';
import { ReviewFilter, ReviewRepository } from '../../repositories/review.repository';

@Injectable()
export class PublicReviewService {
  private readonly inflight = new Map<string, Promise<any>>();

  constructor(
    private readonly reviewRepo: ReviewRepository,
    @Optional() private readonly redis?: RedisService,
  ) {}

  async getList(query: any = {}) {
    const version = await this.getVersion('comic:public:reviews:v');
    const cacheKey = `comic:public:reviews:${version}:${this.hashQuery(query)}`;

    return this.getOrSet(cacheKey, 60, async () => {
      const options = parseQueryOptions(query);

      const filter: ReviewFilter = {};
      if (query.comicId) filter.comicId = query.comicId;

      const [data, total, agg] = await Promise.all([
        this.reviewRepo.findMany(filter, options),
        this.reviewRepo.count(filter),
        this.reviewRepo.aggregateRatingForFilter(filter),
      ]);

      return {
        data,
        meta: createPaginationMeta(options, total),
        stats: {
          average_rating: agg._avg?.rating || 0,
          total_reviews: agg._count || 0,
        },
      };
    });
  }

  private async getVersion(key: string): Promise<string> {
    try {
      if (this.redis?.isEnabled()) {
        return (await this.redis.get(key)) || '0';
      }
    } catch {}
    return '0';
  }

  private hashQuery(query: any): string {
    const stableStr = JSON.stringify(
      query,
      (_, v) => {
        if (v && typeof v === 'object' && !Array.isArray(v)) {
          return Object.keys(v).sort().reduce((o: any, k) => { o[k] = v[k]; return o; }, {});
        }
        return typeof v === 'bigint' ? Number(v) : v;
      },
    );
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

    this.inflight.set(key, promise);
    return promise;
  }
}
