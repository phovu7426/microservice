import { IsEnum, IsOptional, IsString, Matches } from 'class-validator';
import { BaseListQueryDto } from '@package/common';
import { BannerStatus } from '../../enums/banner-status.enum';

export class ListBannersAdminQueryDto extends BaseListQueryDto {
  @IsOptional()
  @IsEnum(BannerStatus)
  status?: BannerStatus;

  @IsOptional()
  @IsString()
  @Matches(/^\d{1,20}$/, { message: 'locationId must be numeric.' })
  locationId?: string;
}
