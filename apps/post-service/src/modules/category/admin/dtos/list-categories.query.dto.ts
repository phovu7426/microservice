import { IsBooleanString, IsOptional, IsString, Matches } from 'class-validator';
import { BaseListQueryDto } from '@package/common';

export class ListCategoriesAdminQueryDto extends BaseListQueryDto {
  // Accepts a numeric id or the literal string 'null' (filter for top-level).
  @IsOptional()
  @IsString()
  @Matches(/^(\d{1,20}|null)$/, { message: 'parentId must be numeric or "null".' })
  parentId?: string;

  @IsOptional()
  @IsBooleanString()
  isActive?: string;
}
