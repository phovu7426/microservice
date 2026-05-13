import { Injectable, NotFoundException, Optional } from '@nestjs/common';
import { PrimaryKey } from 'src/types';
import { CreateFaqDto } from '../dtos/create-faq.dto';
import { UpdateFaqDto } from '../dtos/update-faq.dto';
import { createPaginationMeta, parseQueryOptions } from '@package/common';
import { RedisService } from '@package/redis';
import { FaqFilter, FaqRepository } from '../../repositories/faq.repository';

@Injectable()
export class AdminFaqService {
  constructor(
    private readonly faqRepo: FaqRepository,
    @Optional() private readonly redis?: RedisService,
  ) {}

  private async clearCache(id?: any) {
    await this.redis?.del('introduction:public:faq:list').catch(() => {});
    if (id !== undefined) {
      await this.redis?.del(`introduction:public:faq:detail:${id}`).catch(() => {});
    }
  }

  async getList(query: any = {}) {
    const options = parseQueryOptions(query);

    const filter: FaqFilter = {};
    if (query.search) filter.search = query.search;
    if (query.status) filter.status = query.status;

    const skipCount = query.skipCount === true || query.skipCount === 'true';
    const [data, total] = await Promise.all([
      this.faqRepo.findMany(filter, options),
      skipCount ? Promise.resolve(0) : this.faqRepo.count(filter),
    ]);

    return { data, meta: createPaginationMeta(options, total) };
  }

  async getOne(id: PrimaryKey) {
    const item = await this.faqRepo.findById(id);
    if (!item) throw new NotFoundException('FAQ not found');
    return item;
  }

  async create(dto: CreateFaqDto) {
    const result = await this.faqRepo.create({
      question: dto.question,
      answer: dto.answer,
      status: dto.status || 'active',
      sortOrder: dto.sortOrder ?? 0,
    });
    await this.clearCache();
    return result;
  }

  async update(id: PrimaryKey, dto: UpdateFaqDto) {
    await this.getOne(id);
    const result = await this.faqRepo.update(id, {
      question: dto.question,
      answer: dto.answer,
      status: dto.status,
      sortOrder: dto.sortOrder,
    });
    await this.clearCache(id);
    return result;
  }

  async delete(id: PrimaryKey) {
    await this.getOne(id);
    await this.faqRepo.delete(id);
    await this.clearCache(id);
    return { success: true };
  }
}
