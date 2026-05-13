import { IsOptional, IsString, Matches } from 'class-validator';
import { BaseListQueryDto } from '@package/common';

/**
 * Public comment listing — `status` and `parentId` are forced server-side
 * (`status='visible'`, top-level comments only), so they intentionally are
 * NOT exposed here. Only `comicId` / `chapterId` are caller-controlled.
 */
export class ListCommentsPublicQueryDto extends BaseListQueryDto {
  @IsOptional()
  @IsString()
  @Matches(/^\d{1,20}$/, { message: 'comicId must be numeric.' })
  comicId?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{1,20}$/, { message: 'chapterId must be numeric.' })
  chapterId?: string;
}
