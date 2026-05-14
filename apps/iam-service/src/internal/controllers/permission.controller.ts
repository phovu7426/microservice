import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { Internal, InternalGuard } from '@package/common';
import { PermissionRepository } from '../../modules/permission/repositories/permission.repository';

@Internal()
@UseGuards(InternalGuard)
@Controller('internal/permissions')
export class InternalPermissionController {
  constructor(private readonly repo: PermissionRepository) {}

  @Get('simple')
  getSimple(@Query('search') search?: string) {
    return this.repo.findSimple(search);
  }
}
