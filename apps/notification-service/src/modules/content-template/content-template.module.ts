import { Module } from '@nestjs/common';
import { EnumModule } from '@package/common';
import * as ContentTemplateEnums from './enums';
import { AdminContentTemplateController } from './admin/controllers/content-template.controller';
import { AdminContentTemplateService } from './admin/services/content-template.service';
import { ContentTemplateRepository } from './repositories/content-template.repository';

@Module({
  imports: [
    EnumModule.register({ path: 'templates/enums', enums: ContentTemplateEnums }),
  ],
  controllers: [AdminContentTemplateController],
  providers: [ContentTemplateRepository, AdminContentTemplateService],
  exports: [ContentTemplateRepository],
})
export class ContentTemplateModule {}
