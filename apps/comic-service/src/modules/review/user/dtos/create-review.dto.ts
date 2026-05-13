import { IsNumber, IsOptional, IsString, Min, Max, MaxLength } from 'class-validator';

export class CreateReviewDto {
  @IsNumber()
  comicId: number;

  @IsNumber()
  @Min(1)
  @Max(5)
  rating: number;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  content?: string;
}
