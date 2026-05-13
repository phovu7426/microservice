import {
  IsDateString,
  IsEnum,
  IsHexColor,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { BannerLinkTarget, BannerStatus } from '../../enums/banner-status.enum';

const URL_OPTS = { require_protocol: true, protocols: ['http', 'https'] };

/**
 * Banner DTO is the single point of validation for content that may render
 * on a public page. Free-form `@IsString` was previously letting through
 * `javascript:` and `data:` URLs (XSS via banner link), arbitrary status
 * strings (silently hides the banner), and unbounded description text.
 */
export class CreateBannerDto {
  @IsString()
  @MaxLength(255)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  subtitle?: string;

  @IsOptional()
  @IsUrl(URL_OPTS, { message: 'image must be an http(s) URL.' })
  @MaxLength(500)
  image?: string;

  @IsOptional()
  @IsUrl(URL_OPTS, { message: 'mobileImage must be an http(s) URL.' })
  @MaxLength(500)
  mobileImage?: string;

  @IsOptional()
  @IsUrl(URL_OPTS, { message: 'link must be an http(s) URL.' })
  @MaxLength(500)
  link?: string;

  @IsOptional()
  @IsEnum(BannerLinkTarget)
  linkTarget?: BannerLinkTarget;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  buttonText?: string;

  @IsOptional()
  @IsHexColor()
  buttonColor?: string;

  @IsOptional()
  @IsHexColor()
  textColor?: string;

  @IsNumber()
  @Min(1)
  locationId: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1_000_000)
  sortOrder?: number;

  @IsOptional()
  @IsEnum(BannerStatus)
  status?: BannerStatus;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}
