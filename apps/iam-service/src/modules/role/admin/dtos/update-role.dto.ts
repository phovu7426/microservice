import { IsEnum, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { BasicStatus } from '../../../../common/enums/basic-status.enum';

export class UpdateRoleDto {
  @IsOptional()
  @IsString()
  @MaxLength(150)
  name?: string;

  @IsOptional()
  @IsEnum(BasicStatus)
  status?: BasicStatus;

  @IsOptional()
  @IsString()
  @Matches(/^(\d{1,20})?$/, { message: 'parentId must be numeric or empty.' })
  parentId?: string | null;
}
