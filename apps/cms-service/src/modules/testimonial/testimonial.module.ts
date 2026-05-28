import { Module } from '@nestjs/common';
import { EnumModule } from '@package/common';
import * as TestimonialEnums from './enums';
import { AdminTestimonialController } from './admin/controllers/testimonial.controller';
import { AdminTestimonialService } from './admin/services/testimonial.service';
import { PublicTestimonialController } from './public/controllers/testimonial.controller';
import { PublicTestimonialService } from './public/services/testimonial.service';
import { TestimonialRepository } from './repositories/testimonial.repository';

@Module({
  imports: [EnumModule.register({ path: 'testimonials/enums', enums: TestimonialEnums })],
  controllers: [AdminTestimonialController, PublicTestimonialController],
  providers: [TestimonialRepository, AdminTestimonialService, PublicTestimonialService],
  exports: [TestimonialRepository],
})
export class TestimonialModule {}
