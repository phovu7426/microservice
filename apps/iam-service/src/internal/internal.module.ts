import { Module } from '@nestjs/common';
import { InternalRbacController } from './controllers/rbac-check.controller';
import { InternalPermissionController } from './controllers/permission.controller';
import { InternalGuard } from '@package/common';
import { PermissionModule } from '../modules/permission/permission.module';

@Module({
  imports: [PermissionModule],
  controllers: [InternalRbacController, InternalPermissionController],
  providers: [InternalGuard],
})
export class InternalModule {}
