import { Controller, Get, Param, Query } from '@nestjs/common';
import { Public } from '@package/common';
import { PublicProjectService } from '../services/project.service';
import { ListProjectPublicQueryDto } from '../../admin/dtos/list-project.query.dto';

@Controller('public/projects')
export class PublicProjectController {
  constructor(private readonly projectService: PublicProjectService) {}

  @Public()
  @Get()
  async getList(@Query() query: ListProjectPublicQueryDto) {
    return this.projectService.getList(query);
  }

  @Public()
  @Get('options')
  getOptions() {
    return this.projectService.getOptions();
  }

  @Public()
  @Get(':slug')
  async getBySlug(@Param('slug') slug: string) {
    return this.projectService.getBySlug(slug);
  }
}
