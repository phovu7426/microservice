import { Transform } from 'class-transformer';
import { IsBooleanString, IsEnum, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { BaseListQueryDto } from '@package/common';
import { ComicStatus } from '../../enums/comic-status.enum';

export class ListComicsAdminQueryDto extends BaseListQueryDto {
  @IsOptional()
  @IsEnum(ComicStatus)
  status?: ComicStatus;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  author?: string;

  @IsOptional()
  @IsBooleanString()
  isFeatured?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{1,20}$/, { message: 'categoryId must be numeric.' })
  categoryId?: string;
}

export class ListComicsPublicQueryDto extends BaseListQueryDto {
  @IsOptional()
  @IsBooleanString()
  isFeatured?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{1,20}$/, { message: 'categoryId must be numeric.' })
  categoryId?: string;

  // Frontend sometimes uses `comicCategoryId` as alias.
  @IsOptional()
  @IsString()
  @Matches(/^\d{1,20}$/, { message: 'comicCategoryId must be numeric.' })
  comicCategoryId?: string;
}

export class ListChaptersBySlugQueryDto extends BaseListQueryDto {}
