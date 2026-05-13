import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { BaseListQueryDto } from '@package/common';

export class ListBannersPublicQueryDto extends BaseListQueryDto {
  @IsOptional()
  @IsString()
  @Matches(/^\d{1,20}$/, { message: 'locationId must be numeric.' })
  locationId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  locationCode?: string;
}
