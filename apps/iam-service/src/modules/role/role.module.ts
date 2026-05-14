import { Module } from '@nestjs/common';
import { EnumModule } from '@package/common';
import { RoleController } from './admin/controllers/role.controller';
import { RoleService } from './admin/services/role.service';
import { RoleRepository } from './repositories/role.repository';
import * as RoleEnums from './enums';

@Module({
  imports: [EnumModule.register({ path: 'roles/enums', enums: RoleEnums })],
  controllers: [RoleController],
  providers: [RoleService, RoleRepository],
})
export class RoleModule {}
