import { IsString, IsNumber, IsOptional, MaxLength } from 'class-validator';

export class CreateCommentDto {
  @IsNumber()
  comicId: number;

  @IsOptional()
  @IsNumber()
  chapterId?: number;

  @IsOptional()
  @IsNumber()
  parentId?: number;

  @IsString()
  @MaxLength(5000)
  content: string;
}
