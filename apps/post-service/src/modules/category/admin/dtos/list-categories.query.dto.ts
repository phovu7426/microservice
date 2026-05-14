import { IsEnum, IsOptional, IsString, Matches } from 'class-validator';
import { BaseListQueryDto } from '@package/common';
import { CategoryStatus } from '../../enums/category-status.enum';

export class ListCategoriesAdminQueryDto extends BaseListQueryDto {
  @IsOptional()
  @IsString()
  @Matches(/^(\d{1,20}|null)$/, { message: 'parentId must be numeric or "null".' })
  parentId?: string;

  @IsOptional()
  @IsEnum(CategoryStatus)
  status?: CategoryStatus;
}
