import { IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateCountryDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(10)
  code: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  codeAlpha3?: string;

  @IsNotEmpty()
  @IsString()
  @MaxLength(255)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  officialName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  phoneCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  currencyCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  flagEmoji?: string;

  @IsOptional()
  @IsIn(['active', 'inactive'])
  status?: string;
}
