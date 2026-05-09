import { Injectable, Optional } from '@nestjs/common';
import { RedisService } from '@package/redis';
import { CachedService } from '../../../../../core/cache/cached.service';
import { ProvinceService } from '../../admin/services/province.service';
import { WardService } from '../../../ward/admin/services/ward.service';

@Injectable()
export class PublicProvinceService extends CachedService {
  constructor(
    private readonly provinceService: ProvinceService,
    private readonly wardService: WardService,
    @Optional() redis?: RedisService,
  ) {
    super(redis);
  }

  async getList(query: any = {}) {
    return this.getOrSet('config:public:provinces:all', 86400, async () => {
      return this.provinceService.getList({ ...query, status: 'active' });
    });
  }

  async getByCountry(countryId: string, query: any = {}) {
    return this.getOrSet(`config:public:provinces:${countryId}`, 86400, async () => {
      return this.provinceService.getList({
        ...query,
        countryId,
        status: 'active',
      });
    });
  }

  async getWards(provinceId: string, query: any = {}) {
    return this.getOrSet(`config:public:wards:${provinceId}`, 86400, async () => {
      return this.wardService.getList({
        ...query,
        provinceId,
        status: 'active',
      });
    });
  }
}
