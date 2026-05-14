import { Module } from '@nestjs/common';
import { EnumModule } from '@package/common';
import * as ComicEnums from './enums';
import { AdminComicController } from './admin/controllers/comic.controller';
import { AdminComicService } from './admin/services/comic.service';
import { PublicComicController } from './public/controllers/comic.controller';
import { PublicComicService } from './public/services/comic.service';
import { ComicRepository } from './repositories/comic.repository';

@Module({
  imports: [
    EnumModule.register({ path: 'comics/enums', enums: ComicEnums }),
  ],
  controllers: [AdminComicController, PublicComicController],
  providers: [ComicRepository, AdminComicService, PublicComicService],
  exports: [ComicRepository],
})
export class ComicModule {}
