import { Injectable, Optional } from '@nestjs/common';
import { RedisService } from '@package/redis';
import { CachedService } from '../../../../../core/cache/cached.service';
import { GeneralConfigService } from '../../admin/services/general-config.service';

@Injectable()
export class PublicGeneralConfigService extends CachedService {
  constructor(
    private readonly generalConfigService: GeneralConfigService,
    @Optional() redis?: RedisService,
  ) {
    super(redis);
  }

  async getConfig() {
    return this.getOrSet('config:public:general', 600, async () => {
      const config = (await this.generalConfigService.getConfig()) ?? {};
      return this.transform(config);
    });
  }

  private transform(config: any): any {
    if (!config) return config;
    const item = { ...config };

    if (item.contactChannels) {
      if (typeof item.contactChannels === 'string') {
        try {
          item.contactChannels = JSON.parse(item.contactChannels);
        } catch {
          item.contactChannels = [];
        }
      }
      if (!Array.isArray(item.contactChannels)) {
        item.contactChannels = [];
      }
    } else {
      item.contactChannels = [];
    }

    return item;
  }
}
