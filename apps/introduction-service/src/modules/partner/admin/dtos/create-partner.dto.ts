import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';
import { BasicStatus } from '../../../../common/enums/status.enum';

const URL_OPTS = { require_protocol: true, protocols: ['http', 'https'] };

export class CreatePartnerDto {
  @IsString()
  @MaxLength(255)
  name: string;

  // URL fields validated as http(s) URLs to defeat `javascript:` / `data:`
  // smuggling that becomes XSS when the frontend renders the value.
  @IsOptional()
  @IsUrl(URL_OPTS, { message: 'logo must be an http(s) URL.' })
  @MaxLength(500)
  logo?: string;

  @IsOptional()
  @IsUrl(URL_OPTS, { message: 'website must be an http(s) URL.' })
  @MaxLength(500)
  website?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9_-]{1,50}$/i, { message: 'type must be alphanumeric.' })
  @MaxLength(50)
  type?: string;

  @IsOptional()
  @IsEnum(BasicStatus)
  status?: BasicStatus;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}
