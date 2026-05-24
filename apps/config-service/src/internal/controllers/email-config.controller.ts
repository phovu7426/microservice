import { Controller, Get, UseGuards } from '@nestjs/common';
import { EmailConfigService } from '../../modules/system-config/email/admin/services/email-config.service';
import { Internal, InternalGuard } from '@package/common';

@Controller('email')
export class InternalEmailConfigController {
  constructor(private readonly emailConfigService: EmailConfigService) {}

  @Internal()
  @UseGuards(InternalGuard)
  @Get()
  getConfig() {
    return this.emailConfigService.getRawConfig();
  }
}
