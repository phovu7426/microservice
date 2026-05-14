import { Controller, Get, Post, Put, Delete, Body, Param, Query } from '@nestjs/common';
import { Permission, session } from '@package/common';
import { toPrimaryKey } from 'src/types';
import { PermissionService } from '../services/permission.service';
import { CreatePermissionDto } from '../dtos/create-permission.dto';
import { UpdatePermissionDto } from '../dtos/update-permission.dto';
import { ListPermissionsAdminQueryDto } from '../dtos/list-permission.query.dto';

@Controller('permissions')
export class PermissionController {
  constructor(private readonly service: PermissionService) {}

  @Permission('permission.manage')
  @Get('simple')
  getSimple(@Query('search') search?: string) {
    return this.service.getSimple(search);
  }

  @Permission('permission.manage')
  @Get()
  getList(@Query() query: ListPermissionsAdminQueryDto) {
    return this.service.getList(query);
  }

  @Permission('permission.manage')
  @Get(':id')
  getOne(@Param('id') id: string) {
    return this.service.getOne(toPrimaryKey(id));
  }

  @Permission('permission.manage')
  @Post()
  create(@Body() dto: CreatePermissionDto) {
    const ctx = session()!;
    return this.service.create(dto, toPrimaryKey(ctx.userId!));
  }

  @Permission('permission.manage')
  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdatePermissionDto) {
    const ctx = session()!;
    return this.service.update(toPrimaryKey(id), dto, toPrimaryKey(ctx.userId!));
  }

  @Permission('permission.manage')
  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.service.delete(toPrimaryKey(id));
  }
}
