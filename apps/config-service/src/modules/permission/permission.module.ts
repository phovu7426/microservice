import { Module } from '@nestjs/common';
import { AdminPermissionController } from './admin/controllers/permission.controller';
import { IamClient } from '../../clients/iam.client';

@Module({
  controllers: [AdminPermissionController],
  providers: [IamClient],
})
export class PermissionModule {}
