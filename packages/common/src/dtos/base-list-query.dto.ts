import { Transform, Type } from 'class-transformer';
import {
  IsBooleanString,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';

/**
 * Common pagination + listing query shared across every `*List` endpoint.
 * Services compose this with module-specific filter DTOs:
 *
 *     export class ListPostsQueryDto extends BaseListQueryDto {
 *       \@IsOptional() \@IsString() @Matches(/^\d{1,20}$/)
 *       category_id?: string;
 *     }
 *
 * The global ValidationPipe is configured with `whitelist: true,
 * forbidNonWhitelisted: true`, so any field outside this DTO (or its
 * subclass) is rejected with 400 — no more silent passthrough of arbitrary
 * filter keys into Prisma `where`.
 */
export class BaseListQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  /** Hard cap is enforced again by `parseQueryOptions(maxTake)` in services. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;

  /** Cap free-text search to a sane size and trim whitespace. */
  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(200)
  search?: string;

  /** Allowed forms: `field:asc` / `field:desc`. Service must allowlist `field`. */
  @IsOptional()
  @IsString()
  @Matches(/^[a-z_][a-z0-9_]{0,40}:(asc|desc|ASC|DESC)$/, {
    message: 'sort phải có dạng "field:asc" hoặc "field:desc"',
  })
  sort?: string;

  /** Skip the (potentially expensive) total count for "infinite scroll" lists. */
  @IsOptional()
  @IsBooleanString()
  skipCount?: string;
}
