import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsDateString,
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
import { PostStatus } from '../../enums/post-status.enum';
import { PostType } from '../../enums/post-type.enum';

const URL_OPTS = { require_protocol: true, protocols: ['http', 'https'] };
const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,253}[a-z0-9])?$/;

export class CreatePostDto {
  @IsString()
  @MaxLength(255)
  name: string;

  @IsOptional()
  @IsString()
  @Matches(SLUG_RE, { message: 'slug must be lowercase letters, digits and dashes.' })
  @MaxLength(255)
  slug?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  excerpt?: string;

  @IsOptional()
  @IsString()
  // Posts are stored as TEXT — cap at 200KB to bound DB cost / response size.
  @MaxLength(200_000)
  content?: string;

  @IsOptional()
  @IsUrl(URL_OPTS, { message: 'image must be an http(s) URL.' })
  @MaxLength(500)
  image?: string;

  @IsOptional()
  @IsUrl(URL_OPTS, { message: 'coverImage must be an http(s) URL.' })
  @MaxLength(500)
  coverImage?: string;

  @IsOptional()
  @IsEnum(PostStatus)
  status?: PostStatus;

  @IsOptional()
  @IsEnum(PostType)
  postType?: PostType;

  @IsOptional()
  @IsUrl(URL_OPTS, { message: 'videoUrl must be an http(s) URL.' })
  @MaxLength(500)
  videoUrl?: string;

  @IsOptional()
  @IsUrl(URL_OPTS, { message: 'audioUrl must be an http(s) URL.' })
  @MaxLength(500)
  audioUrl?: string;

  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;

  @IsOptional()
  @IsBoolean()
  isPinned?: boolean;

  // ISO 8601 date — Prisma converts internally; without IsDateString the
  // field accepted any string and `new Date(invalidStr)` quietly produced
  // `Invalid Date` which Prisma rejects with an opaque 500.
  @IsOptional()
  @IsDateString()
  publishedAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  seoTitle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  seoDescription?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  seoKeywords?: string;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(50)
  @IsInt({ each: true })
  @Min(1, { each: true })
  @IsNumber({}, { each: true })
  categoryIds?: number[];

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(50)
  @IsInt({ each: true })
  @Min(1, { each: true })
  @IsNumber({}, { each: true })
  tagIds?: number[];
}
