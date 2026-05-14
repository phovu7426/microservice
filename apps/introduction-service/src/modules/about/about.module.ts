import { Module } from '@nestjs/common';
import { EnumModule } from '@package/common';
import * as AboutEnums from './enums';
import { AdminAboutController } from './admin/controllers/about.controller';
import { AdminAboutService } from './admin/services/about.service';
import { PublicAboutController } from './public/controllers/about.controller';
import { PublicAboutService } from './public/services/about.service';
import { AboutSectionRepository } from './repositories/about-section.repository';

@Module({
  imports: [
    EnumModule.register({ path: 'about/enums', enums: AboutEnums }),
  ],
  controllers: [AdminAboutController, PublicAboutController],
  providers: [AboutSectionRepository, AdminAboutService, PublicAboutService],
  exports: [AboutSectionRepository],
})
export class AboutModule {}
