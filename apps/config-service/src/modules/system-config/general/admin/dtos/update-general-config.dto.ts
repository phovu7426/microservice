import {
  IsString,
  IsOptional,
  IsEmail,
  IsUrl,
  Matches,
  MaxLength,
  IsArray,
  IsBoolean,
  IsNumber,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

const NUMERIC_ID_RE = /^\d{1,20}$/;

class ContactChannelDto {
  @IsString()
  type: string;

  @IsString()
  value: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  label?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  icon?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  urlTemplate?: string;

  @IsBoolean()
  enabled: boolean;

  @IsOptional()
  @IsNumber()
  sortOrder?: number;
}

export class UpdateGeneralConfigDto {
  @IsString()
  @IsOptional()
  @MaxLength(255)
  siteName?: string;

  @IsString()
  @IsOptional()
  siteDescription?: string;

  @IsOptional()
  @IsUrl({ require_protocol: true, protocols: ['http', 'https'] })
  @MaxLength(500)
  siteLogo?: string;

  @IsOptional()
  @IsUrl({ require_protocol: true, protocols: ['http', 'https'] })
  @MaxLength(500)
  siteFavicon?: string;

  @IsEmail()
  @IsOptional()
  @MaxLength(255)
  siteEmail?: string;

  @IsString()
  @IsOptional()
  @MaxLength(20)
  sitePhone?: string;

  @IsString()
  @IsOptional()
  siteAddress?: string;

  @IsOptional()
  @IsString()
  @Matches(NUMERIC_ID_RE, { message: 'siteCountryId must be numeric.' })
  siteCountryId?: string;

  @IsOptional()
  @IsString()
  @Matches(NUMERIC_ID_RE, { message: 'siteProvinceId must be numeric.' })
  siteProvinceId?: string;

  @IsOptional()
  @IsString()
  @Matches(NUMERIC_ID_RE, { message: 'siteWardId must be numeric.' })
  siteWardId?: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  siteCopyright?: string;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  timezone?: string;

  @IsString()
  @IsOptional()
  @MaxLength(10)
  locale?: string;

  @IsString()
  @IsOptional()
  @MaxLength(10)
  currency?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ContactChannelDto)
  contactChannels?: ContactChannelDto[];

  @IsString()
  @IsOptional()
  @MaxLength(255)
  metaTitle?: string;

  @IsString()
  @IsOptional()
  metaKeywords?: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  ogTitle?: string;

  @IsString()
  @IsOptional()
  ogDescription?: string;

  @IsOptional()
  @IsUrl({ require_protocol: true, protocols: ['http', 'https'] })
  @MaxLength(500)
  ogImage?: string;

  @IsOptional()
  @IsUrl({ require_protocol: true, protocols: ['http', 'https'] })
  @MaxLength(500)
  canonicalUrl?: string;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  googleAnalyticsId?: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  googleSearchConsole?: string;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  facebookPixelId?: string;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  twitterSite?: string;
}
