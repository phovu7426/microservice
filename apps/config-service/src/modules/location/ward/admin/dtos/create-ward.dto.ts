import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

export class CreateWardDto {
  @IsNotEmpty()
  @IsString()
  @Matches(/^\d{1,20}$/, { message: 'provinceId must be numeric.' })
  provinceId: string;

  @IsNotEmpty()
  @IsString()
  @MaxLength(255)
  name: string;

  @IsNotEmpty()
  @IsString()
  @MaxLength(50)
  type: string;

  @IsNotEmpty()
  @IsString()
  @MaxLength(20)
  code: string;

  @IsOptional()
  @IsIn(['active', 'inactive'])
  status?: string;
}
