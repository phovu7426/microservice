import { IsString, IsOptional, IsBoolean, MaxLength } from 'class-validator';

export class CreateTagDto {
  @IsString()
  @MaxLength(255)
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
