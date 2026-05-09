import { Injectable, Optional } from '@nestjs/common';
import { RedisService } from '@package/redis';
import { CachedService } from '../../../../../core/cache/cached.service';
import { CountryService } from '../../admin/services/country.service';
import { ProvinceService } from '../../../province/admin/services/province.service';

@Injectable()
export class PublicCountryService extends CachedService {
  constructor(
    private readonly countryService: CountryService,
    private readonly provinceService: ProvinceService,
    @Optional() redis?: RedisService,
  ) {
    super(redis);
  }

  async getList(query: any = {}) {
    return this.getOrSet('config:public:countries', 86400, async () => {
      return this.countryService.getList({ ...query, status: 'active' });
    });
  }

  async getProvinces(countryId: string, query: any = {}) {
    return this.getOrSet(`config:public:provinces:${countryId}`, 86400, async () => {
      return this.provinceService.getList({
        ...query,
        countryId,
        status: 'active',
      });
    });
  }
}
