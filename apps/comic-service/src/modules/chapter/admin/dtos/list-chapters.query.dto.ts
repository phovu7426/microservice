import { IsEnum, IsOptional, IsString, Matches } from 'class-validator';
import { BaseListQueryDto } from '@package/common';
import { ChapterStatus } from '../../enums/chapter-status.enum';

export class ListChaptersAdminQueryDto extends BaseListQueryDto {
  @IsOptional()
  @IsString()
  @Matches(/^\d{1,20}$/, { message: 'comicId must be numeric.' })
  comicId?: string;

  @IsOptional()
  @IsEnum(ChapterStatus)
  status?: ChapterStatus;

  @IsOptional()
  @IsString()
  @Matches(/^\d{1,20}$/, { message: 'teamId must be numeric.' })
  teamId?: string;
}
