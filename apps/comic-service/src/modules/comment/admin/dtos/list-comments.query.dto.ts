import { IsEnum, IsOptional, IsString, Matches } from 'class-validator';
import { BaseListQueryDto } from '@package/common';
import { CommentStatus } from '../../enums/comment-status.enum';

/**
 * Admin listing filters for comments. `status` is constrained to the same set
 * accepted by `UpdateCommentStatusDto` so admins can't filter by a value that
 * could never exist in the database.
 */
export class ListCommentsAdminQueryDto extends BaseListQueryDto {
  @IsOptional()
  @IsString()
  @Matches(/^\d{1,20}$/, { message: 'comicId must be numeric.' })
  comicId?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{1,20}$/, { message: 'chapterId must be numeric.' })
  chapterId?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{1,20}$/, { message: 'userId must be numeric.' })
  userId?: string;

  @IsOptional()
  @IsEnum(CommentStatus)
  status?: CommentStatus;
}
