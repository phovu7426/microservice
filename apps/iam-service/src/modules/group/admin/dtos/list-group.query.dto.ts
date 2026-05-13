import { IsEnum, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { BaseListQueryDto } from '@package/common';
import { BasicStatus } from '../../../../common/enums/basic-status.enum';

export class ListGroupsAdminQueryDto extends BaseListQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  type?: string;

  @IsOptional()
  @IsEnum(BasicStatus)
  status?: BasicStatus;

  @IsOptional()
  @IsString()
  @Matches(/^\d{1,20}$/, { message: 'contextId must be numeric.' })
  contextId?: string;
}

export class ListGroupMembersAdminQueryDto extends BaseListQueryDto {}
