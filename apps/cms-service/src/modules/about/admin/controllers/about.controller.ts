import { Controller, Get, Post, Patch, Delete, Body, Param, Query } from '@nestjs/common';
import { Permission } from '@package/common';
import { toPrimaryKey } from 'src/types';
import { AdminAboutService } from '../services/about.service';
import { CreateAboutDto } from '../dtos/create-about.dto';
import { UpdateAboutDto } from '../dtos/update-about.dto';
import { ListAboutAdminQueryDto } from '../dtos/list-about.query.dto';

@Controller('admin/about-sections')
export class AdminAboutController {
  constructor(private readonly aboutService: AdminAboutService) {}

  @Permission('cms.about.manage')
  @Get()
  async getList(@Query() query: ListAboutAdminQueryDto) {
    return this.aboutService.getList(query);
  }

  @Permission('cms.about.manage')
  @Get(':id')
  async getOne(@Param('id') id: string) {
    return this.aboutService.getOne(toPrimaryKey(id));
  }

  @Permission('cms.about.manage')
  @Post()
  async create(@Body() dto: CreateAboutDto) {
    return this.aboutService.create(dto);
  }

  @Permission('cms.about.manage')
  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateAboutDto) {
    return this.aboutService.update(toPrimaryKey(id), dto);
  }

  @Permission('cms.about.manage')
  @Delete(':id')
  async delete(@Param('id') id: string) {
    return this.aboutService.delete(toPrimaryKey(id));
  }
}
