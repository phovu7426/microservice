import { Controller, Get, Query } from '@nestjs/common';
import { Permission } from '@package/common';
import { IamClient } from '../../../../clients/iam.client';

@Controller('admin/permissions')
export class AdminPermissionController {
  constructor(private readonly iamClient: IamClient) {}

  @Permission('menu.manage')
  @Get()
  getSimple(@Query('search') search?: string) {
    return this.iamClient.getPermissionsSimple(search);
  }
}
