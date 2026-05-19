import { Controller, Get, Post, Patch, Delete, Body, Param, Query } from '@nestjs/common';
import { Permission } from '@package/common';
import { toPrimaryKey } from 'src/types';
import { AdminProjectService } from '../services/project.service';
import { CreateProjectDto } from '../dtos/create-project.dto';
import { UpdateProjectDto } from '../dtos/update-project.dto';
import { ListProjectAdminQueryDto } from '../dtos/list-project.query.dto';

@Controller('admin/projects')
export class AdminProjectController {
  constructor(private readonly projectService: AdminProjectService) {}

  @Permission('cms.project.manage')
  @Get()
  async getList(@Query() query: ListProjectAdminQueryDto) {
    return this.projectService.getList(query);
  }

  @Permission('cms.project.manage')
  @Get(':id')
  async getOne(@Param('id') id: string) {
    return this.projectService.getOne(toPrimaryKey(id));
  }

  @Permission('cms.project.manage')
  @Post()
  async create(@Body() dto: CreateProjectDto) {
    return this.projectService.create(dto);
  }

  @Permission('cms.project.manage')
  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateProjectDto) {
    return this.projectService.update(toPrimaryKey(id), dto);
  }

  @Permission('cms.project.manage')
  @Delete(':id')
  async delete(@Param('id') id: string) {
    return this.projectService.delete(toPrimaryKey(id));
  }
}
