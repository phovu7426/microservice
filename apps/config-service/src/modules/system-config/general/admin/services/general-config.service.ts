import { Injectable, InternalServerErrorException, Optional } from '@nestjs/common';
import { RedisService } from '@package/redis';
import { I18nContext, I18nService } from 'nestjs-i18n';
import { GeneralConfigRepository } from '../../repositories/general-config.repository';
import { UpdateGeneralConfigDto } from '../dtos/update-general-config.dto';
import { buildConfigPayload } from '../../../helpers/config-payload.helper';

@Injectable()
export class GeneralConfigService {
  constructor(
    private readonly generalConfigRepo: GeneralConfigRepository,
    private readonly i18n: I18nService,
    @Optional() private readonly redis?: RedisService,
  ) {}

  async getConfig(): Promise<any> {
    const config = await this.generalConfigRepo.getConfig();
    return config;
  }

  async updateConfig(dto: UpdateGeneralConfigDto, userId?: any): Promise<any> {
    const existing = await this.generalConfigRepo.getConfig();

    const bigIntFields = ['siteCountryId', 'siteProvinceId', 'siteWardId'];
    const payload = buildConfigPayload(dto, bigIntFields, userId, existing);

    // Prisma fields are now camelCase — pass payload directly
    const dbPayload: any = {};
    const validFields = [
      'siteName', 'siteDescription', 'siteLogo', 'siteFavicon',
      'siteEmail', 'sitePhone', 'siteAddress', 'siteCountryId',
      'siteProvinceId', 'siteWardId', 'siteCopyright', 'timezone',
      'locale', 'currency', 'contactChannels', 'metaTitle',
      'metaKeywords', 'ogTitle', 'ogDescription', 'ogImage',
      'canonicalUrl', 'googleAnalyticsId', 'googleSearchConsole',
      'facebookPixelId', 'twitterSite', 'createdUserId', 'updatedUserId',
    ];

    for (const field of validFields) {
      if (payload[field] !== undefined) {
        dbPayload[field] = payload[field];
      }
    }

    // Atomic upsert avoids the race in which two concurrent first-writes
    // both pass `existing == null` and create duplicate config rows.
    const createPayload = {
      ...dbPayload,
      siteName: dbPayload.siteName || 'My Website',
      timezone: dbPayload.timezone || 'Asia/Ho_Chi_Minh',
      locale: dbPayload.locale || 'vi',
      currency: dbPayload.currency || 'VND',
    };

    const result = await this.generalConfigRepo.upsert(createPayload, dbPayload);

    if (!result) {
      const lang = I18nContext.current()?.lang ?? 'en';
      throw new InternalServerErrorException(
        this.i18n.t('system-config.GENERAL_UPDATE_FAILED', { lang }),
      );
    }

    await this.clearGeneralConfigCaches();
    return result;
  }

  private async clearGeneralConfigCaches(): Promise<void> {
    await this.redis?.del('config:public:general');
  }
}
