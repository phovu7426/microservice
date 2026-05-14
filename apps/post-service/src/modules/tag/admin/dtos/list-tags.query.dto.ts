import { IsEnum, IsOptional } from 'class-validator';
import { BaseListQueryDto } from '@package/common';
import { TagStatus } from '../../enums/tag-status.enum';

export class ListTagsAdminQueryDto extends BaseListQueryDto {
  @IsOptional()
  @IsEnum(TagStatus)
  status?: TagStatus;
}
