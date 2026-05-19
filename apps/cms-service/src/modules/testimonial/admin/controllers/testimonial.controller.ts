import { Controller, Get, Post, Patch, Delete, Body, Param, Query } from '@nestjs/common';
import { Permission } from '@package/common';
import { toPrimaryKey } from 'src/types';
import { AdminTestimonialService } from '../services/testimonial.service';
import { CreateTestimonialDto } from '../dtos/create-testimonial.dto';
import { UpdateTestimonialDto } from '../dtos/update-testimonial.dto';
import { ListTestimonialAdminQueryDto } from '../dtos/list-testimonial.query.dto';

@Controller('admin/testimonials')
export class AdminTestimonialController {
  constructor(private readonly testimonialService: AdminTestimonialService) {}

  @Permission('cms.testimonial.manage')
  @Get()
  async getList(@Query() query: ListTestimonialAdminQueryDto) {
    return this.testimonialService.getList(query);
  }

  @Permission('cms.testimonial.manage')
  @Get(':id')
  async getOne(@Param('id') id: string) {
    return this.testimonialService.getOne(toPrimaryKey(id));
  }

  @Permission('cms.testimonial.manage')
  @Post()
  async create(@Body() dto: CreateTestimonialDto) {
    return this.testimonialService.create(dto);
  }

  @Permission('cms.testimonial.manage')
  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateTestimonialDto) {
    return this.testimonialService.update(toPrimaryKey(id), dto);
  }

  @Permission('cms.testimonial.manage')
  @Delete(':id')
  async delete(@Param('id') id: string) {
    return this.testimonialService.delete(toPrimaryKey(id));
  }
}
