import { ConflictException, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { Prisma } from 'src/generated/prisma';
import { PrimaryKey } from 'src/types';
import { RedisService } from '@package/redis';
import { CreateBannerLocationDto } from '../dtos/create-banner-location.dto';
import { UpdateBannerLocationDto } from '../dtos/update-banner-location.dto';
import { ChangeStatusDto } from '../dtos/change-status.dto';
import { createPaginationMeta, parseQueryOptions } from '@package/common';
import { BannerLocationFilter, BannerLocationRepository } from '../../repositories/banner-location.repository';
import { BannerStatus } from '../../../banner/enums/banner-status.enum';

@Injectable()
export class AdminBannerLocationService {
  constructor(
    private readonly locationRepo: BannerLocationRepository,
    @Optional() private readonly redis?: RedisService,
  ) {}

  private async clearCache(): Promise<void> {
    await this.redis?.del('cms:public:banners:list').catch(() => {});
  }

  private mapP2002(err: unknown): never {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new ConflictException('Banner location code already exists');
    }
    throw err;
  }

  async getList(query: any = {}) {
    const options = parseQueryOptions(query);

    const filter: BannerLocationFilter = {};
    if (query.search) filter.search = query.search;
    if (query.status) filter.status = query.status;

    const skipCount = query.skipCount === true || query.skipCount === 'true';
    const [data, total] = await Promise.all([
      this.locationRepo.findMany(filter, options),
      skipCount ? Promise.resolve(0) : this.locationRepo.count(filter),
    ]);

    return { data, meta: createPaginationMeta(options, total) };
  }

  async getOne(id: PrimaryKey) {
    const location = await this.locationRepo.findById(id);
    if (!location) throw new NotFoundException('Banner location not found');
    return location;
  }

  async create(dto: CreateBannerLocationDto) {
    const existing = await this.locationRepo.findByCode(dto.code);
    if (existing) throw new ConflictException('Banner location code already exists');

    try {
      const created = await this.locationRepo.create({
        code: dto.code,
        name: dto.name,
        description: dto.description,
        status: dto.status || BannerStatus.active,
      });
      await this.clearCache();
      return created;
    } catch (err) {
      // Concurrent creates raced our `findByCode` check.
      this.mapP2002(err);
    }
  }

  async update(id: PrimaryKey, dto: UpdateBannerLocationDto) {
    await this.getOne(id);

    if (dto.code) {
      const existing = await this.locationRepo.findCodeConflict(dto.code, id);
      if (existing) throw new ConflictException('Banner location code already exists');
    }

    try {
      const updated = await this.locationRepo.update(id, dto);
      await this.clearCache();
      return updated;
    } catch (err) {
      this.mapP2002(err);
    }
  }

  async delete(id: PrimaryKey) {
    const location = await this.getOne(id);

    const bannerCount = await this.locationRepo.countBanners(id);
    if (bannerCount > 0) {
      throw new ConflictException('Banner location has banners and cannot be deleted');
    }

    await this.locationRepo.delete(id);
    await this.clearCache();
    return { success: true };
  }

  async changeStatus(id: PrimaryKey, dto: ChangeStatusDto) {
    await this.getOne(id);
    const updated = await this.locationRepo.update(id, { status: dto.status });
    await this.clearCache();
    return updated;
  }

  async getOptions() {
    return this.locationRepo.findOptions();
  }
}
