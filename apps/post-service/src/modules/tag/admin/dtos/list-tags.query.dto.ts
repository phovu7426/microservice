import { IsBooleanString, IsOptional } from 'class-validator';
import { BaseListQueryDto } from '@package/common';

export class ListTagsAdminQueryDto extends BaseListQueryDto {
  @IsOptional()
  @IsBooleanString()
  isActive?: string;
}
