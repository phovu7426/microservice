import { Controller, Get, Post, Put, Delete, Body, Param, Query } from '@nestjs/common';
import { Permission } from '@package/common';
import { toPrimaryKey } from 'src/types';
import { AdminBannerService } from '../services/banner.service';
import { CreateBannerDto } from '../dtos/create-banner.dto';
import { UpdateBannerDto } from '../dtos/update-banner.dto';
import { ListBannersAdminQueryDto } from '../dtos/list-banners.query.dto';

@Controller('admin/banners')
export class AdminBannerController {
  constructor(private readonly bannerService: AdminBannerService) {}

  @Permission('cms.banner.manage')
  @Get()
  async getList(@Query() query: ListBannersAdminQueryDto) {
    return this.bannerService.getList(query);
  }

  @Permission('cms.banner.manage')
  @Get(':id')
  async getOne(@Param('id') id: string) {
    return this.bannerService.getOne(toPrimaryKey(id));
  }

  @Permission('cms.banner.manage')
  @Post()
  async create(@Body() dto: CreateBannerDto) {
    return this.bannerService.create(dto);
  }

  @Permission('cms.banner.manage')
  @Put(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateBannerDto) {
    return this.bannerService.update(toPrimaryKey(id), dto);
  }

  @Permission('cms.banner.manage')
  @Delete(':id')
  async delete(@Param('id') id: string) {
    return this.bannerService.delete(toPrimaryKey(id));
  }
}
