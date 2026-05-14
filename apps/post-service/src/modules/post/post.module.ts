import { Module } from '@nestjs/common';
import { EnumModule } from '@package/common';
import * as PostEnums from './enums';
import { AdminPostController } from './admin/controllers/post.controller';
import { AdminPostService } from './admin/services/post.service';
import { PublicPostController } from './public/controllers/post.controller';
import { PublicPostService } from './public/services/post.service';
import { PostRepository } from './repositories/post.repository';

@Module({
  imports: [
    EnumModule.register({ path: 'posts/enums', enums: PostEnums }),
  ],
  controllers: [AdminPostController, PublicPostController],
  providers: [PostRepository, AdminPostService, PublicPostService],
  exports: [PostRepository],
})
export class PostModule {}
