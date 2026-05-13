import { IsBooleanString, IsEnum, IsOptional, IsString, Matches } from 'class-validator';
import { BaseListQueryDto } from '@package/common';
import { PostStatus } from '../../enums/post-status.enum';
import { PostType } from '../../enums/post-type.enum';

export class ListPostsAdminQueryDto extends BaseListQueryDto {
  @IsOptional()
  @IsEnum(PostStatus)
  status?: PostStatus;

  @IsOptional()
  @IsEnum(PostType)
  postType?: PostType;

  @IsOptional()
  @IsBooleanString()
  isFeatured?: string;

  @IsOptional()
  @IsBooleanString()
  isPinned?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{1,20}$/, { message: 'categoryId must be numeric.' })
  categoryId?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{1,20}$/, { message: 'tagId must be numeric.' })
  tagId?: string;
}
