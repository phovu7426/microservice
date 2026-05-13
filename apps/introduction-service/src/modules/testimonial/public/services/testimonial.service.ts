import { Injectable, NotFoundException, Optional } from '@nestjs/common';
import { PrimaryKey } from 'src/types';
import { createPaginationMeta, parseQueryOptions } from '@package/common';
import { RedisService } from '@package/redis';
import { TestimonialFilter, TestimonialRepository } from '../../repositories/testimonial.repository';
import { BasicStatus } from '../../../../common/enums/status.enum';

@Injectable()
export class PublicTestimonialService {
  private readonly inflight = new Map<string, Promise<any>>();

  constructor(
    private readonly testimonialRepo: TestimonialRepository,
    @Optional() private readonly redis?: RedisService,
  ) {}

  private async getOrSet<T>(key: string, ttl: number, loader: () => Promise<T>): Promise<T> {
    const cached = await this.redis?.get(key).catch(() => null);
    if (cached) return JSON.parse(cached);
    const existing = this.inflight.get(key);
    if (existing) return existing;
    const promise = loader().then(async (result) => {
      this.inflight.delete(key);
      await this.redis?.set(key, JSON.stringify(result, (_, v) => (typeof v === 'bigint' ? Number(v) : v)), ttl).catch(() => {});
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

    const filter: TestimonialFilter = { status: BasicStatus.active };
    if (query.featured !== undefined) {
      filter.featured = query.featured === 'true' || query.featured === true;
    }
    if (query.projectId) filter.projectId = query.projectId;

    return this.getOrSet('introduction:public:testimonial:list', 300, async () => {
      const [data, total] = await Promise.all([
        this.testimonialRepo.findMany(filter, options),
        this.testimonialRepo.count(filter),
      ]);
      return { data, meta: createPaginationMeta(options, total) };
    });
  }

  async getOne(id: PrimaryKey) {
    return this.getOrSet(`introduction:public:testimonial:detail:${id}`, 600, async () => {
      const item = await this.testimonialRepo.findActiveById(id);
      if (!item) throw new NotFoundException('Testimonial not found');
      return item;
    });
  }
}
