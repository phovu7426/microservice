import { Module } from '@nestjs/common';
import { EnumModule } from '@package/common';
import * as FaqEnums from './enums';
import { AdminFaqController } from './admin/controllers/faq.controller';
import { AdminFaqService } from './admin/services/faq.service';
import { PublicFaqController } from './public/controllers/faq.controller';
import { PublicFaqService } from './public/services/faq.service';
import { FaqRepository } from './repositories/faq.repository';

@Module({
  imports: [EnumModule.register({ path: 'faqs/enums', enums: FaqEnums })],
  controllers: [AdminFaqController, PublicFaqController],
  providers: [FaqRepository, AdminFaqService, PublicFaqService],
  exports: [FaqRepository],
})
export class FaqModule {}
