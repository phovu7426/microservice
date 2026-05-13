import { Injectable, NotFoundException, Optional } from '@nestjs/common';
import { PrimaryKey } from 'src/types';
import { CreateBannerDto } from '../dtos/create-banner.dto';
import { UpdateBannerDto } from '../dtos/update-banner.dto';
import { createPaginationMeta, parseQueryOptions } from '@package/common';
import { RedisService } from '@package/redis';
import { BannerFilter, BannerRepository } from '../../repositories/banner.repository';
import { BannerLocationRepository } from '../../../banner-location/repositories/banner-location.repository';

@Injectable()
export class AdminBannerService {
  constructor(
    private readonly bannerRepo: BannerRepository,
    private readonly locationRepo: BannerLocationRepository,
    @Optional() private readonly redis?: RedisService,
  ) {}

  private async clearCache(): Promise<void> {
    await this.redis?.del('marketing:public:banners:list').catch(() => {});
  }

  async getList(query: any = {}) {
    const options = parseQueryOptions(query);

    const filter: BannerFilter = {};
    if (query.search) filter.search = query.search;
    if (query.status) filter.status = query.status;
    if (query.locationId) filter.locationId = query.locationId;

    const skipCount = query.skipCount === true || query.skipCount === 'true';
    const [data, total] = await Promise.all([
      this.bannerRepo.findMany(filter, options),
      skipCount ? Promise.resolve(0) : this.bannerRepo.count(filter),
    ]);

    return { data, meta: createPaginationMeta(options, total) };
  }

  async getOne(id: PrimaryKey) {
    const banner = await this.bannerRepo.findById(id);
    if (!banner) throw new NotFoundException('Banner not found');
    return banner;
  }

  async create(dto: CreateBannerDto) {
    await this.assertLocationExists(dto.locationId);

    const banner = await this.bannerRepo.create({
      title: dto.title,
      subtitle: dto.subtitle,
      image: dto.image,
      mobileImage: dto.mobileImage,
      link: dto.link,
      linkTarget: dto.linkTarget,
      description: dto.description,
      buttonText: dto.buttonText,
      buttonColor: dto.buttonColor,
      textColor: dto.textColor,
      locationId: dto.locationId,
      sortOrder: dto.sortOrder ?? 0,
      status: dto.status || 'active',
      startDate: dto.startDate,
      endDate: dto.endDate,
    });

    await this.clearCache();
    return this.getOne(banner.id);
  }

  async update(id: PrimaryKey, dto: UpdateBannerDto) {
    await this.getOne(id);

    if (dto.locationId) {
      await this.assertLocationExists(dto.locationId);
    }

    await this.bannerRepo.update(id, {
      title: dto.title,
      subtitle: dto.subtitle,
      image: dto.image,
      mobileImage: dto.mobileImage,
      link: dto.link,
      linkTarget: dto.linkTarget,
      description: dto.description,
      buttonText: dto.buttonText,
      buttonColor: dto.buttonColor,
      textColor: dto.textColor,
      locationId: dto.locationId,
      sortOrder: dto.sortOrder,
      status: dto.status,
      startDate: dto.startDate,
      endDate: dto.endDate,
    });
    await this.clearCache();
    return this.getOne(id);
  }

  async delete(id: PrimaryKey) {
    await this.getOne(id);
    await this.bannerRepo.delete(id);
    await this.clearCache();
    return { success: true };
  }

  private async assertLocationExists(locationId: any) {
    const location = await this.locationRepo.findById(locationId);
    if (!location) throw new NotFoundException('Banner location not found');
  }
}
