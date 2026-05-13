import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  Min,
} from 'class-validator';
import { AboutSectionType } from '../../enums/about-section-type.enum';
import { BasicStatus } from '../../../../common/enums/status.enum';

const URL_OPTS = { require_protocol: true, protocols: ['http', 'https'] };

export class CreateAboutDto {
  @IsString()
  @MaxLength(255)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  slug?: string;

  @IsOptional()
  @IsString()
  // Capped because it's stored as TEXT and rendered into pages.
  @MaxLength(20_000)
  content?: string;

  @IsOptional()
  @IsUrl(URL_OPTS, { message: 'image must be an http(s) URL.' })
  @MaxLength(500)
  image?: string;

  @IsOptional()
  @IsUrl(URL_OPTS, { message: 'videoUrl must be an http(s) URL.' })
  @MaxLength(500)
  videoUrl?: string;

  @IsOptional()
  @IsEnum(AboutSectionType)
  sectionType?: AboutSectionType;

  @IsOptional()
  @IsEnum(BasicStatus)
  status?: BasicStatus;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}
