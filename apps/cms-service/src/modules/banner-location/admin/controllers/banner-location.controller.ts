import { Controller, Get, Post, Put, Delete, Body, Param, Query, Patch } from '@nestjs/common';
import { Permission } from '@package/common';
import { toPrimaryKey } from 'src/types';
import { AdminBannerLocationService } from '../services/banner-location.service';
import { CreateBannerLocationDto } from '../dtos/create-banner-location.dto';
import { UpdateBannerLocationDto } from '../dtos/update-banner-location.dto';
import { ChangeStatusDto } from '../dtos/change-status.dto';
import { ListBannerLocationsAdminQueryDto } from '../dtos/list-banner-locations.query.dto';

@Controller('admin/banner-locations')
export class AdminBannerLocationController {
  constructor(private readonly bannerLocationService: AdminBannerLocationService) {}

  @Permission('cms.banner_location.manage')
  @Get()
  async getList(@Query() query: ListBannerLocationsAdminQueryDto) {
    return this.bannerLocationService.getList(query);
  }

  @Permission('cms.banner_location.manage')
  @Get(':id')
  async getOne(@Param('id') id: string) {
    return this.bannerLocationService.getOne(toPrimaryKey(id));
  }

  @Permission('cms.banner_location.manage')
  @Post()
  async create(@Body() dto: CreateBannerLocationDto) {
    return this.bannerLocationService.create(dto);
  }

  @Permission('cms.banner_location.manage')
  @Put(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateBannerLocationDto) {
    return this.bannerLocationService.update(toPrimaryKey(id), dto);
  }

  @Permission('cms.banner_location.manage')
  @Delete(':id')
  async delete(@Param('id') id: string) {
    return this.bannerLocationService.delete(toPrimaryKey(id));
  }

  @Permission('cms.banner_location.manage')
  @Patch(':id/status')
  async changeStatus(@Param('id') id: string, @Body() body: ChangeStatusDto) {
    return this.bannerLocationService.changeStatus(toPrimaryKey(id), body);
  }
}
