import { Controller, Get, Post, Patch, Delete, Body, Param, Query } from '@nestjs/common';
import { Permission } from '@package/common';
import { toPrimaryKey } from 'src/types';
import { AdminPartnerService } from '../services/partner.service';
import { CreatePartnerDto } from '../dtos/create-partner.dto';
import { UpdatePartnerDto } from '../dtos/update-partner.dto';
import { ListPartnerAdminQueryDto } from '../dtos/list-partner.query.dto';

@Controller('admin/partners')
export class AdminPartnerController {
  constructor(private readonly partnerService: AdminPartnerService) {}

  @Permission('cms.partner.manage')
  @Get()
  async getList(@Query() query: ListPartnerAdminQueryDto) {
    return this.partnerService.getList(query);
  }

  @Permission('cms.partner.manage')
  @Get(':id')
  async getOne(@Param('id') id: string) {
    return this.partnerService.getOne(toPrimaryKey(id));
  }

  @Permission('cms.partner.manage')
  @Post()
  async create(@Body() dto: CreatePartnerDto) {
    return this.partnerService.create(dto);
  }

  @Permission('cms.partner.manage')
  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdatePartnerDto) {
    return this.partnerService.update(toPrimaryKey(id), dto);
  }

  @Permission('cms.partner.manage')
  @Delete(':id')
  async delete(@Param('id') id: string) {
    return this.partnerService.delete(toPrimaryKey(id));
  }
}
