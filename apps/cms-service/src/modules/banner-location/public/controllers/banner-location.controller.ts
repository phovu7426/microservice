import { Controller, Get } from '@nestjs/common';
import { Public } from '@package/common';
import { PublicBannerLocationService } from '../services/banner-location.service';

@Controller('public/banner-locations')
export class PublicBannerLocationController {
  constructor(private readonly service: PublicBannerLocationService) {}

  @Public()
  @Get('options')
  getOptions() {
    return this.service.getOptions();
  }
}
