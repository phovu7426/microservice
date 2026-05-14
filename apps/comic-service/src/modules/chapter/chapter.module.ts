import { Module } from '@nestjs/common';
import { EnumModule } from '@package/common';
import * as ChapterEnums from './enums';
import { AdminChapterController } from './admin/controllers/chapter.controller';
import { AdminChapterService } from './admin/services/chapter.service';
import { PublicChapterController } from './public/controllers/chapter.controller';
import { PublicChapterService } from './public/services/chapter.service';
import { ChapterRepository } from './repositories/chapter.repository';

@Module({
  imports: [
    EnumModule.register({ path: 'chapters/enums', enums: ChapterEnums }),
  ],
  controllers: [AdminChapterController, PublicChapterController],
  providers: [ChapterRepository, AdminChapterService, PublicChapterService],
  exports: [ChapterRepository],
})
export class ChapterModule {}
