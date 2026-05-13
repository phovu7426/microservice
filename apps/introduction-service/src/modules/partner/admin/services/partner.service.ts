import { Injectable, NotFoundException, Optional } from '@nestjs/common';
import { PrimaryKey } from 'src/types';
import { CreatePartnerDto } from '../dtos/create-partner.dto';
import { UpdatePartnerDto } from '../dtos/update-partner.dto';
import { createPaginationMeta, parseQueryOptions } from '@package/common';
import { RedisService } from '@package/redis';
import { PartnerFilter, PartnerRepository } from '../../repositories/partner.repository';

@Injectable()
export class AdminPartnerService {
  constructor(
    private readonly partnerRepo: PartnerRepository,
    @Optional() private readonly redis?: RedisService,
  ) {}

  private async clearCache(id?: any) {
    await this.redis?.del('introduction:public:partner:list').catch(() => {});
    if (id !== undefined) {
      await this.redis?.del(`introduction:public:partner:detail:${id}`).catch(() => {});
    }
  }

  async getList(query: any = {}) {
    const options = parseQueryOptions(query);

    const filter: PartnerFilter = {};
    if (query.search) filter.search = query.search;
    if (query.status) filter.status = query.status;
    if (query.type) filter.type = query.type;

    const skipCount = query.skipCount === true || query.skipCount === 'true';
    const [data, total] = await Promise.all([
      this.partnerRepo.findMany(filter, options),
      skipCount ? Promise.resolve(0) : this.partnerRepo.count(filter),
    ]);

    return { data, meta: createPaginationMeta(options, total) };
  }

  async getOne(id: PrimaryKey) {
    const item = await this.partnerRepo.findById(id);
    if (!item) throw new NotFoundException('Partner not found');
    return item;
  }

  async create(dto: CreatePartnerDto) {
    const result = await this.partnerRepo.create({
      name: dto.name,
      logo: dto.logo,
      website: dto.website,
      description: dto.description,
      type: dto.type,
      status: dto.status || 'active',
      sortOrder: dto.sortOrder ?? 0,
    });
    await this.clearCache();
    return result;
  }

  async update(id: PrimaryKey, dto: UpdatePartnerDto) {
    await this.getOne(id);
    const result = await this.partnerRepo.update(id, {
      name: dto.name,
      logo: dto.logo,
      website: dto.website,
      description: dto.description,
      type: dto.type,
      status: dto.status,
      sortOrder: dto.sortOrder,
    });
    await this.clearCache(id);
    return result;
  }

  async delete(id: PrimaryKey) {
    await this.getOne(id);
    await this.partnerRepo.delete(id);
    await this.clearCache(id);
    return { success: true };
  }
}
