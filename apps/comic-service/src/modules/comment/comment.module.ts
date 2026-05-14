import { Module } from '@nestjs/common';
import { EnumModule } from '@package/common';
import * as CommentEnums from './enums';
import { AdminCommentController } from './admin/controllers/comments.controller';
import { AdminCommentService } from './admin/services/comments.service';
import { PublicCommentController } from './public/controllers/comments.controller';
import { PublicCommentService } from './public/services/comments.service';
import { UserCommentController } from './user/controllers/comments.controller';
import { UserCommentService } from './user/services/comments.service';
import { CommentRepository } from './repositories/comment.repository';

@Module({
  imports: [
    EnumModule.register({ path: 'comics/comments/enums', enums: CommentEnums }),
  ],
  controllers: [AdminCommentController, PublicCommentController, UserCommentController],
  providers: [CommentRepository, AdminCommentService, PublicCommentService, UserCommentService],
  exports: [CommentRepository],
})
export class CommentModule {}
