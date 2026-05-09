import { Controller, Get } from '@nestjs/common';
import { Public } from '@package/common';
import { PublicGeneralConfigService } from '../services/general-config.service';

@Controller('general')
export class PublicGeneralConfigController {
  constructor(private readonly service: PublicGeneralConfigService) {}

  @Public()
  @Get()
  async getConfig() {
    return this.service.getConfig();
  }
}
