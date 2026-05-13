import { Injectable, NotFoundException, Optional } from '@nestjs/common';
import { PrimaryKey } from 'src/types';
import { CreateTestimonialDto } from '../dtos/create-testimonial.dto';
import { UpdateTestimonialDto } from '../dtos/update-testimonial.dto';
import { createPaginationMeta, parseQueryOptions } from '@package/common';
import { RedisService } from '@package/redis';
import { TestimonialFilter, TestimonialRepository } from '../../repositories/testimonial.repository';

@Injectable()
export class AdminTestimonialService {
  constructor(
    private readonly testimonialRepo: TestimonialRepository,
    @Optional() private readonly redis?: RedisService,
  ) {}

  private async clearCache(id?: any) {
    await this.redis?.del('introduction:public:testimonial:list').catch(() => {});
    if (id !== undefined) {
      await this.redis?.del(`introduction:public:testimonial:detail:${id}`).catch(() => {});
    }
  }

  async getList(query: any = {}) {
    const options = parseQueryOptions(query);

    const filter: TestimonialFilter = {};
    if (query.search) filter.search = query.search;
    if (query.status) filter.status = query.status;
    if (query.featured !== undefined) {
      filter.featured = query.featured === 'true' || query.featured === true;
    }
    if (query.projectId) filter.projectId = query.projectId;

    const skipCount = query.skipCount === true || query.skipCount === 'true';
    const [data, total] = await Promise.all([
      this.testimonialRepo.findMany(filter, options),
      skipCount ? Promise.resolve(0) : this.testimonialRepo.count(filter),
    ]);

    return { data, meta: createPaginationMeta(options, total) };
  }

  async getOne(id: PrimaryKey) {
    const item = await this.testimonialRepo.findById(id);
    if (!item) throw new NotFoundException('Testimonial not found');
    return item;
  }

  async create(dto: CreateTestimonialDto) {
    const result = await this.testimonialRepo.create({
      clientName: dto.clientName,
      clientPosition: dto.clientPosition,
      clientCompany: dto.clientCompany,
      clientAvatar: dto.clientAvatar,
      content: dto.content,
      rating: dto.rating ?? 5,
      projectId: dto.projectId,
      featured: dto.featured ?? false,
      status: dto.status || 'active',
      sortOrder: dto.sortOrder ?? 0,
    });
    await this.clearCache();
    return result;
  }

  async update(id: PrimaryKey, dto: UpdateTestimonialDto) {
    await this.getOne(id);
    const result = await this.testimonialRepo.update(id, {
      clientName: dto.clientName,
      clientPosition: dto.clientPosition,
      clientCompany: dto.clientCompany,
      clientAvatar: dto.clientAvatar,
      content: dto.content,
      rating: dto.rating,
      projectId: dto.projectId,
      featured: dto.featured,
      status: dto.status,
      sortOrder: dto.sortOrder,
    });
    await this.clearCache(id);
    return result;
  }

  async delete(id: PrimaryKey) {
    await this.getOne(id);
    await this.testimonialRepo.delete(id);
    await this.clearCache(id);
    return { success: true };
  }
}
