import { IsEnum, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { BasicStatus } from '../../../../common/enums/basic-status.enum';

export class UpdateGroupDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsOptional()
  @IsEnum(BasicStatus)
  status?: BasicStatus;

  @IsOptional()
  @IsString()
  @Matches(/^(\d{1,20})?$/, { message: 'ownerId must be numeric or empty.' })
  ownerId?: string | null;
}
