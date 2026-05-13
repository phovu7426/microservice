import { IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class CreateContextDto {
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  @Matches(/^[a-z][a-z0-9_-]{1,49}$/i, { message: 'type must be alphanumeric.' })
  type: string;

  @IsString()
  @MinLength(2)
  @MaxLength(100)
  @Matches(/^[a-z][a-z0-9_.-]{1,99}$/i, { message: 'code is invalid.' })
  code: string;

  @IsString()
  @MaxLength(255)
  name: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{1,20}$/, { message: 'refId must be numeric.' })
  refId?: string;
}
