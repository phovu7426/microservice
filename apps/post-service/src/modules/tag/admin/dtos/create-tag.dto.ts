import { IsString, IsOptional, IsEnum, MaxLength } from 'class-validator';
import { TagStatus } from '../../enums/tag-status.enum';

export class CreateTagDto {
  @IsString()
  @MaxLength(255)
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(TagStatus)
  status?: TagStatus;
}
