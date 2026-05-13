import { IsIn, IsOptional, IsString, Matches } from 'class-validator';
import { BaseListQueryDto } from '@package/common';

export class ListReviewsAdminQueryDto extends BaseListQueryDto {
  @IsOptional()
  @IsString()
  @Matches(/^\d{1,20}$/, { message: 'comicId must be numeric.' })
  comicId?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{1,20}$/, { message: 'userId must be numeric.' })
  userId?: string;

  /**
   * Reviews are 1..5 stars. Service casts via `Number(query.rating)`, but we
   * still accept it as a string from the URL and constrain to the allowed set
   * so a typo or fractional value can't sneak past `Number()` and produce a
   * silent zero-row Prisma filter.
   */
  @IsOptional()
  @IsIn(['1', '2', '3', '4', '5'])
  rating?: string;
}
