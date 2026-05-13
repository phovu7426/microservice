import { IsEnum, IsOptional } from 'class-validator';
import { BaseListQueryDto } from '@package/common';
import { StatsSortBy } from '../../enums/stats-sort-by.enum';

/**
 * Query for the admin "top comics" leaderboard.
 *
 * The service only consumes `limit` (from `BaseListQueryDto`) and `sortBy`,
 * mapping `sortBy` to one of three Prisma `orderBy` clauses. Anything else
 * would be rejected by the global `forbidNonWhitelisted` ValidationPipe.
 */
export class TopComicsAdminQueryDto extends BaseListQueryDto {
  @IsOptional()
  @IsEnum(StatsSortBy)
  sortBy?: StatsSortBy;
}
