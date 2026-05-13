import { BadRequestException, ForbiddenException, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { I18nService } from 'nestjs-i18n';
import { RedisService } from '@package/redis';
import { t } from '@package/common';
import { PrimaryKey, toPrimaryKey } from 'src/types';
import { PUBLIC_POST_STATUSES } from '../../../post/enums/post-status.enum';
import { CreateCommentDto } from '../dtos/create-comment.dto';
import { CommentRepository } from '../../repositories/comment.repository';

const MAX_REPLY_DEPTH = 1;

@Injectable()
export class UserCommentService {
  constructor(
    private readonly commentRepo: CommentRepository,
    private readonly config: ConfigService,
    private readonly i18n: I18nService,
    @Optional() private readonly redis?: RedisService,
  ) {}

  async create(userId: PrimaryKey, dto: CreateCommentDto) {
    const kafkaEnabled = !!this.config.get<boolean>('kafka.enabled');

    // Verify the target post exists AND is in a publicly-visible state.
    // Without this, anyone can comment on draft/archived posts.
    const post = await this.commentRepo.existsPublicPost(toPrimaryKey(dto.postId), PUBLIC_POST_STATUSES);
    if (!post) throw new NotFoundException(t(this.i18n, 'post.POST_NOT_FOUND'));

    let parent: Awaited<ReturnType<CommentRepository['findById']>> | null = null;
    if (dto.parentId) {
      parent = await this.commentRepo.findById(dto.parentId);
      if (!parent) throw new NotFoundException(t(this.i18n, 'post.PARENT_COMMENT_NOT_FOUND'));
      if (String(parent.postId) !== String(dto.postId)) {
        throw new ForbiddenException(t(this.i18n, 'post.PARENT_COMMENT_DIFFERENT_POST'));
      }
      // Enforce one-level threading: nested replies past depth 1 become
      // invisible to the renderer, so just refuse them at write time.
      if ((parent as any).parentId != null) {
        throw new BadRequestException(t(this.i18n, 'post.REPLY_DEPTH_EXCEEDED'));
      }
    }

    const commentData = {
      // Authenticated user — strip guestName/guestEmail regardless of
      // DTO contents so an authenticated user cannot pose as a guest.
      userId: userId,
      postId: dto.postId,
      parentId: dto.parentId ?? null,
      content: dto.content,
      createdUserId: userId,
    };

    const needsOutbox = kafkaEnabled && parent && String(parent.userId) !== String(userId);

    const result = await this.commentRepo.withTransaction(async (tx) => {
      const comment = await this.commentRepo.create(commentData, tx);

      if (needsOutbox) {
        await this.commentRepo.createOutbox(
          'post.comment.created',
          {
            comment_id: String(comment.id),
            post_id: String(comment.postId),
            user_id: String(userId),
            parent_comment_id: String(dto.parentId),
            parent_comment_user_id: parent!.userId ? String(parent!.userId) : null,
          },
          tx,
        );
      }

      return comment;
    });

    await this.incrementVersion('post:public:comments:v');
    return result;
  }

  async update(userId: PrimaryKey, id: PrimaryKey, content: string) {
    const comment = await this.commentRepo.findById(id);
    if (!comment) throw new NotFoundException(t(this.i18n, 'post.COMMENT_NOT_FOUND'));
    if (String(comment.userId) !== String(userId)) {
      throw new ForbiddenException(t(this.i18n, 'post.NOT_YOUR_COMMENT'));
    }
    const result = await this.commentRepo.update(id, { content, updatedUserId: userId });
    await this.incrementVersion('post:public:comments:v');
    return result;
  }

  async delete(userId: PrimaryKey, id: PrimaryKey) {
    const comment = await this.commentRepo.findById(id);
    if (!comment) throw new NotFoundException(t(this.i18n, 'post.COMMENT_NOT_FOUND'));
    if (String(comment.userId) !== String(userId)) {
      throw new ForbiddenException(t(this.i18n, 'post.NOT_YOUR_COMMENT'));
    }
    await this.commentRepo.delete(id);
    await this.incrementVersion('post:public:comments:v');
    return { success: true };
  }

  private async incrementVersion(key: string): Promise<void> {
    try {
      if (this.redis?.isEnabled()) {
        await this.redis.incr(key);
      }
    } catch {}
  }
}
