import { Injectable, NotFoundException, Optional } from '@nestjs/common';
import { PrimaryKey } from 'src/types';
import { createPaginationMeta, parseQueryOptions } from '@package/common';
import { RedisService } from '@package/redis';
import { FaqFilter, FaqRepository } from '../../repositories/faq.repository';
import { BasicStatus } from '../../../../common/enums/status.enum';

@Injectable()
export class PublicFaqService {
  private readonly inflight = new Map<string, Promise<any>>();

  constructor(
    private readonly faqRepo: FaqRepository,
    @Optional() private readonly redis?: RedisService,
  ) {}

  private async getOrSet<T>(key: string, ttl: number, loader: () => Promise<T>): Promise<T> {
    const cached = await this.redis?.get(key).catch(() => null);
    if (cached) return JSON.parse(cached);
    const existing = this.inflight.get(key);
    if (existing) return existing;
    const promise = loader().then(async (result) => {
      this.inflight.delete(key);
      await this.redis?.set(key, JSON.stringify(result), ttl).catch(() => {});
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

    const filter: FaqFilter = { status: BasicStatus.active };
    if (query.search) filter.search = query.search;

    return this.getOrSet('introduction:public:faq:list', 300, async () => {
      const [data, total] = await Promise.all([
        this.faqRepo.findMany(filter, options),
        this.faqRepo.count(filter),
      ]);
      return { data, meta: createPaginationMeta(options, total) };
    });
  }

  async getOne(id: PrimaryKey) {
    return this.getOrSet(`introduction:public:faq:detail:${id}`, 600, async () => {
      const item = await this.faqRepo.findActiveById(id);
      if (!item) throw new NotFoundException('FAQ not found');
      return item;
    });
  }

  async incrementViewCount(id: PrimaryKey) {
    const item = await this.getOne(id);
    await this.faqRepo.update(id, { viewCount: { increment: 1 } });
    return { success: true, view_count: item.viewCount + 1 };
  }

  async incrementHelpfulCount(id: PrimaryKey) {
    const item = await this.getOne(id);
    await this.faqRepo.update(id, { helpfulCount: { increment: 1 } });
    return { success: true, helpful_count: item.helpfulCount + 1 };
  }
}
