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

    // Map camelCase payload → snake_case Prisma fields
    const dbPayload: any = {};
    const fieldMap: Record<string, string> = {
      siteName: 'site_name',
      siteDescription: 'site_description',
      siteLogo: 'site_logo',
      siteFavicon: 'site_favicon',
      siteEmail: 'site_email',
      sitePhone: 'site_phone',
      siteAddress: 'site_address',
      siteCountryId: 'site_country_id',
      siteProvinceId: 'site_province_id',
      siteWardId: 'site_ward_id',
      siteCopyright: 'site_copyright',
      timezone: 'timezone',
      locale: 'locale',
      currency: 'currency',
      contactChannels: 'contact_channels',
      metaTitle: 'meta_title',
      metaKeywords: 'meta_keywords',
      ogTitle: 'og_title',
      ogDescription: 'og_description',
      ogImage: 'og_image',
      canonicalUrl: 'canonical_url',
      googleAnalyticsId: 'google_analytics_id',
      googleSearchConsole: 'google_search_console',
      facebookPixelId: 'facebook_pixel_id',
      twitterSite: 'twitter_site',
      // Internal fields set by buildConfigPayload (already snake_case)
      created_user_id: 'created_user_id',
      updated_user_id: 'updated_user_id',
    };

    for (const [camel, snake] of Object.entries(fieldMap)) {
      if (payload[camel] !== undefined) {
        dbPayload[snake] = payload[camel];
      }
    }

    // Atomic upsert avoids the race in which two concurrent first-writes
    // both pass `existing == null` and create duplicate config rows.
    const createPayload = {
      ...dbPayload,
      site_name: dbPayload.site_name || 'My Website',
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
