import { IsNumber, Min } from 'class-validator';

export class CreateBookmarkDto {
  @IsNumber()
  chapterId: number;

  @IsNumber()
  @Min(1)
  pageNumber: number;
}
