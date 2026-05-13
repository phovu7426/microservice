import { IsBooleanString, IsEnum, IsOptional, IsString, Matches } from 'class-validator';
import { BaseListQueryDto } from '@package/common';
import { BasicStatus } from '../../../../common/enums/status.enum';

export class ListTestimonialAdminQueryDto extends BaseListQueryDto {
  @IsOptional()
  @IsEnum(BasicStatus)
  status?: BasicStatus;

  @IsOptional()
  @IsBooleanString()
  featured?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{1,20}$/, { message: 'projectId must be numeric.' })
  projectId?: string;
}

export class ListTestimonialPublicQueryDto extends BaseListQueryDto {
  @IsOptional()
  @IsBooleanString()
  featured?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{1,20}$/, { message: 'projectId must be numeric.' })
  projectId?: string;
}
