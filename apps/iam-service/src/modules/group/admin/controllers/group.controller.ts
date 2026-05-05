import { Controller, Get, Post, Put, Delete, Body, Param, Query, Req } from '@nestjs/common';
import { Permission } from '@package/common';
import { toPrimaryKey } from 'src/types';
import { GroupService } from '../services/group.service';
import { CreateGroupDto } from '../dtos/create-group.dto';
import { UpdateGroupDto } from '../dtos/update-group.dto';
import { AddMemberDto } from '../dtos/add-member.dto';
import { ListGroupsAdminQueryDto, ListGroupMembersAdminQueryDto } from '../dtos/list-group.query.dto';

@Controller('groups')
export class GroupController {
  constructor(private readonly service: GroupService) {}

  @Permission('group.manage')
  @Get()
  getList(@Query() query: ListGroupsAdminQueryDto) {
    return this.service.getList(query);
  }

  @Permission('group.manage')
  @Get(':id')
  getOne(@Param('id') id: string) {
    return this.service.getOne(toPrimaryKey(id));
  }

  @Permission('group.manage')
  @Post()
  create(@Body() dto: CreateGroupDto, @Req() req: any) {
    return this.service.create(dto, toPrimaryKey(req.user.sub));
  }

  @Permission('group.manage')
  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateGroupDto, @Req() req: any) {
    return this.service.update(toPrimaryKey(id), dto, toPrimaryKey(req.user.sub));
  }

  @Permission('group.manage')
  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.service.delete(toPrimaryKey(id));
  }

  @Permission('group.manage')
  @Get(':id/members')
  getMembers(@Param('id') id: string, @Query() query: ListGroupMembersAdminQueryDto) {
    return this.service.getMembers(toPrimaryKey(id), query);
  }

  @Permission('group.manage')
  @Post(':id/members')
  addMember(@Param('id') id: string, @Body() dto: AddMemberDto) {
    return this.service.addMember(toPrimaryKey(id), dto);
  }

  @Permission('group.manage')
  @Delete(':id/members/:userId')
  removeMember(@Param('id') id: string, @Param('userId') userId: string) {
    return this.service.removeMember(toPrimaryKey(id), toPrimaryKey(userId));
  }
}
