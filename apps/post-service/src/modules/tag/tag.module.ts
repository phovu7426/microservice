import { Module } from '@nestjs/common';
import { AdminTagController } from './admin/controllers/tag.controller';
import { AdminTagService } from './admin/services/tag.service';
import { PublicTagController } from './public/controllers/tag.controller';
import { PublicTagService } from './public/services/tag.service';
import { TagRepository } from './repositories/tag.repository';
import { EnumModule } from '@package/common';
import * as TagEnums from './enums';

@Module({
  imports: [EnumModule.register({ path: 'post-tags/enums', enums: TagEnums })],
  controllers: [AdminTagController, PublicTagController],
  providers: [TagRepository, AdminTagService, PublicTagService],
  exports: [TagRepository],
})
export class TagModule {}
