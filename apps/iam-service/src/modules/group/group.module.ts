import { Module } from '@nestjs/common';
import { GroupController } from './admin/controllers/group.controller';
import { GroupService } from './admin/services/group.service';
import { GroupRepository } from './repositories/group.repository';
import { UserGroupController } from './user/controllers/user-group.controller';
import { UserGroupService } from './user/services/user-group.service';

@Module({
  controllers: [GroupController, UserGroupController],
  providers: [GroupService, GroupRepository, UserGroupService],
})
export class GroupModule {}
