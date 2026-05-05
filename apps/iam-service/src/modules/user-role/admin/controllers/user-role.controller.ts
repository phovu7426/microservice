import { BadRequestException, Controller, Get, Post, Put, Delete, Body, Param, Query, Req } from '@nestjs/common';
import { Permission } from '@package/common';
import { UserRoleService } from '../services/user-role.service';
import { AssignRoleDto } from '../dtos/assign-role.dto';
import { SyncUserRolesDto } from '../dtos/sync-user-roles.dto';

function actorFromReq(req: any) {
  return {
    id: String(req?.user?.sub ?? req?.user?.id ?? ''),
    groupId: (req?.headers?.['x-group-id'] as string | undefined) ?? null,
  };
}

function validateId(value: string, name: string): string {
  if (!value || !/^\d+$/.test(value)) {
    throw new BadRequestException(`Invalid ${name}`);
  }
  return value;
}

@Controller('users')
export class UserRoleController {
  constructor(private readonly service: UserRoleService) {}

  @Permission('user.role.assign')
  @Get(':userId/roles')
  getUserRoles(@Param('userId') userId: string, @Query('groupId') groupId?: string) {
    return this.service.getUserRoles(validateId(userId, 'userId'), groupId);
  }

  @Permission('user.role.assign')
  @Post(':userId/roles')
  assignRole(@Param('userId') userId: string, @Body() dto: AssignRoleDto, @Req() req: any) {
    return this.service.assignRole(validateId(userId, 'userId'), dto, actorFromReq(req));
  }

  @Permission('user.role.assign')
  @Delete(':userId/roles/:roleId')
  removeRole(
    @Param('userId') userId: string,
    @Param('roleId') roleId: string,
    @Query('groupId') groupId: string,
    @Req() req: any,
  ) {
    validateId(userId, 'userId');
    validateId(roleId, 'roleId');
    validateId(groupId, 'groupId');
    return this.service.removeRole(userId, roleId, groupId, actorFromReq(req));
  }

  @Permission('user.role.assign')
  @Put(':userId/roles/sync')
  syncRoles(@Param('userId') userId: string, @Body() dto: SyncUserRolesDto, @Req() req: any) {
    return this.service.syncRoles(validateId(userId, 'userId'), dto, actorFromReq(req));
  }
}
