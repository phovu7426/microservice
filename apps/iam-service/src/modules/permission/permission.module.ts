import { Module } from '@nestjs/common';
import { EnumModule } from '@package/common';
import * as PermissionEnums from './enums';
import { PermissionController } from './admin/controllers/permission.controller';
import { PermissionService } from './admin/services/permission.service';
import { PermissionRepository } from './repositories/permission.repository';

@Module({
  imports: [
    EnumModule.register({ path: 'permissions/enums', enums: PermissionEnums }),
  ],
  controllers: [PermissionController],
  providers: [PermissionService, PermissionRepository],
  exports: [PermissionRepository],
})
export class PermissionModule {}
