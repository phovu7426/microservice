import { BadRequestException, ForbiddenException, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { PrimaryKey } from 'src/types';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '@package/redis';
import { I18nService } from 'nestjs-i18n';
import { t } from '@package/common';
import { PUBLIC_COMIC_STATUSES } from '../../../comic/enums/comic-status.enum';
import { CreateCommentDto } from '../dtos/create-comment.dto';
import { CommentRepository } from '../../repositories/comment.repository';

const MAX_REPLY_DEPTH = 1;

@Injectable()
export class UserCommentService {
  constructor(
    private readonly commentRepo: CommentRepository,
    private readonly i18n: I18nService,
    private readonly config: ConfigService,
    @Optional() private readonly redis?: RedisService,
  ) {}

  async create(userId: PrimaryKey, dto: CreateCommentDto) {
    // Refuse to comment on a draft/scheduled comic. Without this check, any
    // authenticated user could post comments on unpublished work.
    const comic = await this.commentRepo.existsPublicComic(dto.comicId, PUBLIC_COMIC_STATUSES);
    if (!comic) throw new NotFoundException(t(this.i18n, 'comic.NOT_FOUND'));

    if (dto.chapterId) {
      // Chapter must belong to the same comic AND be published.
      const chapter = await this.commentRepo.existsPublishedChapter(dto.chapterId, dto.comicId);
      if (!chapter) {
        throw new BadRequestException(t(this.i18n, 'comic.CHAPTER_INVALID'));
      }
    }

    let parent: Awaited<ReturnType<CommentRepository['findById']>> | null = null;
    if (dto.parentId) {
      parent = await this.commentRepo.findById(dto.parentId);
      if (!parent) throw new NotFoundException(t(this.i18n, 'comic.PARENT_COMMENT_NOT_FOUND'));
      if (String(parent.comicId) !== String(dto.comicId)) {
        throw new ForbiddenException(t(this.i18n, 'comic.PARENT_COMMENT_MISMATCH'));
      }
      // One-level threading: nested replies past depth 1 become invisible
      // because the public view only loads first-level replies.
      if ((parent as any).parentId != null) {
        throw new BadRequestException(t(this.i18n, 'comic.REPLY_DEPTH_EXCEEDED'));
      }
    }

    const kafkaEnabled = !!this.config.get<boolean>('kafka.enabled');

    const commentData = {
      userId: userId,
      comicId: dto.comicId,
      chapterId: dto.chapterId ?? null,
      parentId: dto.parentId ?? null,
      content: dto.content,
    };

    const needsOutbox = kafkaEnabled && parent && String(parent.userId) !== String(userId);

    const result = await this.commentRepo.withTransaction(async (tx) => {
      const comment = await this.commentRepo.create(commentData, tx);

      if (needsOutbox) {
        await this.commentRepo.createOutbox(
          'comic.comment.created',
          {
            comment_id: String(comment.id),
            comic_id: String(dto.comicId),
            chapter_id: dto.chapterId ? String(dto.chapterId) : null,
            user_id: String(userId),
            parent_comment_id: String(dto.parentId),
            parent_comment_user_id: String(parent!.userId),
          },
          tx,
        );
      }

      return comment;
    });

    await this.incrementVersion('comic:public:comments:v');
    return result;
  }

  async update(userId: PrimaryKey, id: PrimaryKey, content: string) {
    const comment = await this.commentRepo.findById(id);
    if (!comment) throw new NotFoundException(t(this.i18n, 'comic.COMMENT_NOT_FOUND'));
    if (String(comment.userId) !== String(userId)) throw new ForbiddenException(t(this.i18n, 'comic.FORBIDDEN'));
    const result = await this.commentRepo.update(id, { content });
    await this.incrementVersion('comic:public:comments:v');
    return result;
  }

  async delete(userId: PrimaryKey, id: PrimaryKey) {
    const comment = await this.commentRepo.findById(id);
    if (!comment) throw new NotFoundException(t(this.i18n, 'comic.COMMENT_NOT_FOUND'));
    if (String(comment.userId) !== String(userId)) throw new ForbiddenException(t(this.i18n, 'comic.FORBIDDEN'));
    // Soft-delete via status to preserve thread context (replies still
    // resolve their parent without becoming orphans).
    const result = await this.commentRepo.update(id, { status: 'deleted' });
    await this.incrementVersion('comic:public:comments:v');
    return result;
  }

  private async incrementVersion(key: string): Promise<void> {
    try {
      if (this.redis?.isEnabled()) {
        await this.redis.incr(key);
      }
    } catch {}
  }
}
