import { Injectable, Optional } from '@nestjs/common';
import { createPaginationMeta, parseQueryOptions } from '@package/common';
import { RedisService } from '@package/redis';
import { BannerFilter, BannerRepository } from '../../repositories/banner.repository';
import { BannerStatus } from '../../enums/banner-status.enum';

@Injectable()
export class PublicBannerService {
  private readonly inflight = new Map<string, Promise<any>>();

  constructor(
    private readonly bannerRepo: BannerRepository,
    @Optional() private readonly redis?: RedisService,
  ) {}

  private async getOrSet<T>(key: string, ttl: number, loader: () => Promise<T>): Promise<T> {
    if (this.redis?.isEnabled()) {
      const cached = await this.redis.get(key);
      if (cached) return JSON.parse(cached);
    }
    const existing = this.inflight.get(key);
    if (existing) return existing;
    const promise = loader().then(async (result) => {
      this.inflight.delete(key);
      if (this.redis?.isEnabled()) {
        await this.redis.set(key, JSON.stringify(result, (_, v) => (typeof v === 'bigint' ? Number(v) : v)), ttl).catch(() => {});
      }
      return result;
    }).catch((err) => {
      this.inflight.delete(key);
      throw err;
    });
    this.inflight.set(key, promise);
    return promise;
  }

  async getList(query: any = {}) {
    const options = parseQueryOptions(query);

    const filter: BannerFilter = {
      status: BannerStatus.active,
      activeAt: new Date(),
    };
    if (query.locationId) filter.locationId = query.locationId;
    if (query.locationCode) filter.locationCode = query.locationCode;

    return this.getOrSet('marketing:public:banners:list', 300, async () => {
      const [data, total] = await Promise.all([
        this.bannerRepo.findManyPublic(filter, options),
        this.bannerRepo.count(filter),
      ]);
      return { data, meta: createPaginationMeta(options, total) };
    });
  }
}
