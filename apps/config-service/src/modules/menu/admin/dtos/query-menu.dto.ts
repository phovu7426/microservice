import { IsOptional, IsString, IsEnum, IsBoolean, Matches, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { BaseListQueryDto } from '@package/common';
import { BasicStatus } from '../../enums/basic-status.enum';

const toBool = ({ value }: { value: any }) =>
  value === true || value === 'true' || value === '1' || value === 1;

export class QueryMenuDto extends BaseListQueryDto {
  @IsOptional()
  @IsEnum(BasicStatus)
  status?: BasicStatus;

  @IsOptional()
  @IsString()
  @Matches(/^\d{1,20}$/, { message: 'parentId must be numeric.' })
  parentId?: string;

  @IsOptional()
  @IsBoolean()
  @Transform(toBool)
  showInMenu?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  group?: string;
}
