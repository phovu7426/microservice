import { IsBooleanString, IsEnum, IsOptional, IsString, Matches } from 'class-validator';
import { BaseListQueryDto } from '@package/common';
import { PostType } from '../../enums/post-type.enum';

export class ListPostsPublicQueryDto extends BaseListQueryDto {
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

  // Frontend sometimes uses `postCategoryId` as alias.
  @IsOptional()
  @IsString()
  @Matches(/^\d{1,20}$/, { message: 'postCategoryId must be numeric.' })
  postCategoryId?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{1,20}$/, { message: 'tagId must be numeric.' })
  tagId?: string;

  // Frontend sometimes uses `postTagId` as alias.
  @IsOptional()
  @IsString()
  @Matches(/^\d{1,20}$/, { message: 'postTagId must be numeric.' })
  postTagId?: string;
}
