import {
  Controller,
  Put,
  Body,
  ValidationPipe,
} from '@nestjs/common';
import { EmailConfigService } from '../services/email-config.service';
import { UpdateEmailConfigDto } from '../dtos/update-email-config.dto';
import { Permission, session } from '@package/common';

@Controller('admin/email')
export class AdminEmailConfigController {
  constructor(
    private readonly emailConfigService: EmailConfigService,
  ) {}

  /**
   * PUT /api/config/email — admin (JWT required)
   */
  @Permission('config.manage')
  @Put()
  updateConfig(
    @Body(ValidationPipe) dto: UpdateEmailConfigDto,
  ) {
    const ctx = session()!;
    const userId = ctx.userId;
    return this.emailConfigService.updateConfig(dto, userId);
  }
}
