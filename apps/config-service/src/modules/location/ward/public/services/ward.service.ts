import { Injectable, Optional } from '@nestjs/common';
import { RedisService } from '@package/redis';
import { CachedService } from '../../../../../core/cache/cached.service';
import { WardService } from '../../admin/services/ward.service';

@Injectable()
export class PublicWardService extends CachedService {
  constructor(
    private readonly wardService: WardService,
    @Optional() redis?: RedisService,
  ) {
    super(redis);
  }

  async getList(query: any = {}) {
    return this.getOrSet('config:public:wards:all', 86400, async () => {
      return this.wardService.getList({ ...query, status: 'active' });
    });
  }

  async getByProvince(provinceId: string, query: any = {}) {
    return this.getOrSet(`config:public:wards:${provinceId}`, 86400, async () => {
      return this.wardService.getList({
        ...query,
        provinceId,
        status: 'active',
      });
    });
  }
}
