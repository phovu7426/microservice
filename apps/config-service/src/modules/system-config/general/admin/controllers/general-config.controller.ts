import {
  Controller,
  Get,
  Put,
  Body,
  ValidationPipe,
} from '@nestjs/common';
import { GeneralConfigService } from '../services/general-config.service';
import { UpdateGeneralConfigDto } from '../dtos/update-general-config.dto';
import { Permission, session } from '@package/common';

@Controller('admin/general')
export class AdminGeneralConfigController {
  constructor(
    private readonly generalConfigService: GeneralConfigService,
  ) {}

  @Permission('config.manage')
  @Get()
  async getConfig() {
    return this.generalConfigService.getConfig();
  }

  @Permission('config.manage')
  @Put()
  async updateConfig(
    @Body(ValidationPipe) dto: UpdateGeneralConfigDto,
  ) {
    const ctx = session()!;
    const userId = ctx.userId;
    return this.generalConfigService.updateConfig(dto, userId);
  }
}
