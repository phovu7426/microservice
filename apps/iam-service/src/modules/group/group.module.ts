import { Module } from '@nestjs/common';
import { EnumModule } from '@package/common';
import { GroupController } from './admin/controllers/group.controller';
import { GroupService } from './admin/services/group.service';
import { GroupRepository } from './repositories/group.repository';
import { UserGroupController } from './user/controllers/user-group.controller';
import { UserGroupService } from './user/services/user-group.service';
import * as GroupEnums from './enums';

@Module({
  imports: [EnumModule.register({ path: 'groups/enums', enums: GroupEnums })],
  controllers: [GroupController, UserGroupController],
  providers: [GroupService, GroupRepository, UserGroupService],
  exports: [GroupRepository],
})
export class GroupModule {}
