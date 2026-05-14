import { Module } from '@nestjs/common';
import { EnumModule } from '@package/common';
import { AdminBannerLocationController } from './admin/controllers/banner-location.controller';
import { AdminBannerLocationService } from './admin/services/banner-location.service';
import { BannerLocationRepository } from './repositories/banner-location.repository';
import * as BannerLocationEnums from './enums';

@Module({
  imports: [EnumModule.register({ path: 'banner-locations/enums', enums: BannerLocationEnums })],
  controllers: [AdminBannerLocationController],
  providers: [BannerLocationRepository, AdminBannerLocationService],
  exports: [BannerLocationRepository],
})
export class BannerLocationModule {}
