import { Controller, Get, Post, Patch, Delete, Body, Param, Query } from '@nestjs/common';
import { Permission } from '@package/common';
import { toPrimaryKey } from 'src/types';
import { AdminGalleryService } from '../services/gallery.service';
import { CreateGalleryDto } from '../dtos/create-gallery.dto';
import { UpdateGalleryDto } from '../dtos/update-gallery.dto';
import { ListGalleryAdminQueryDto } from '../dtos/list-gallery.query.dto';

@Controller('admin/galleries')
export class AdminGalleryController {
  constructor(private readonly galleryService: AdminGalleryService) {}

  @Permission('cms.gallery.manage')
  @Get()
  async getList(@Query() query: ListGalleryAdminQueryDto) {
    return this.galleryService.getList(query);
  }

  @Permission('cms.gallery.manage')
  @Get(':id')
  async getOne(@Param('id') id: string) {
    return this.galleryService.getOne(toPrimaryKey(id));
  }

  @Permission('cms.gallery.manage')
  @Post()
  async create(@Body() dto: CreateGalleryDto) {
    return this.galleryService.create(dto);
  }

  @Permission('cms.gallery.manage')
  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateGalleryDto) {
    return this.galleryService.update(toPrimaryKey(id), dto);
  }

  @Permission('cms.gallery.manage')
  @Delete(':id')
  async delete(@Param('id') id: string) {
    return this.galleryService.delete(toPrimaryKey(id));
  }
}
