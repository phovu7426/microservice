import { Controller, Get, Req } from '@nestjs/common';
import { Permission } from '@package/common';
import { UserGroupService } from '../services/user-group.service';

@Controller('user/groups')
export class UserGroupController {
  constructor(private readonly service: UserGroupService) {}

  @Permission('user')
  @Get()
  getUserGroups(@Req() req: any) {
    return this.service.getUserGroups(String(req.user.sub));
  }
}
