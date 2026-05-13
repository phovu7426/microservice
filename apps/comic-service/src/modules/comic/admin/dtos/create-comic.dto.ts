import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';
import { ComicStatus } from '../../enums/comic-status.enum';

const URL_OPTS = { require_protocol: true, protocols: ['http', 'https'] };
const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,253}[a-z0-9])?$/;

export class CreateComicDto {
  @IsString()
  @MaxLength(255)
  title: string;

  @IsOptional()
  @IsString()
  @Matches(SLUG_RE, { message: 'slug must be lowercase letters, digits, dashes.' })
  @MaxLength(255)
  slug?: string;

  @IsOptional()
  @IsString()
  // Cap description — stored as TEXT, rendered into pages.
  @MaxLength(20_000)
  description?: string;

  @IsOptional()
  @IsUrl(URL_OPTS, { message: 'coverImage must be an http(s) URL.' })
  @MaxLength(500)
  coverImage?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  author?: string;

  @IsOptional()
  @IsEnum(ComicStatus)
  status?: ComicStatus;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(50)
  @IsInt({ each: true })
  @Min(1, { each: true })
  @IsNumber({}, { each: true })
  categoryIds?: number[];

  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;
}
