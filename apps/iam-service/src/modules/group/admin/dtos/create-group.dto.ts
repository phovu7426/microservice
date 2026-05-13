import { IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class CreateGroupDto {
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  @Matches(/^[a-z][a-z0-9_-]{1,49}$/i, { message: 'type is invalid.' })
  type: string;

  @IsString()
  @MinLength(2)
  @MaxLength(100)
  @Matches(/^[a-z][a-z0-9_.-]{1,99}$/i, { message: 'code is invalid.' })
  code: string;

  @IsString()
  @MaxLength(255)
  name: string;

  @IsString()
  @Matches(/^\d{1,20}$/, { message: 'contextId must be numeric.' })
  contextId: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{1,20}$/, { message: 'ownerId must be numeric.' })
  ownerId?: string;
}
