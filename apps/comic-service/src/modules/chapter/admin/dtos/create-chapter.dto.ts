import {
  IsString,
  IsOptional,
  IsNumber,
  IsArray,
  IsEnum,
  MaxLength,
  ValidateNested,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ChapterStatus } from '../../enums/chapter-status.enum';

export class CreateChapterPageDto {
  @IsString()
  @MaxLength(500)
  imageUrl: string;

  @IsOptional()
  @IsNumber()
  width?: number;

  @IsOptional()
  @IsNumber()
  height?: number;

  @IsOptional()
  @IsNumber()
  fileSize?: number;
}

export class CreateChapterDto {
  @IsNumber()
  comicId: number;

  @IsOptional()
  @IsNumber()
  teamId?: number;

  @IsString()
  @MaxLength(255)
  title: string;

  @IsNumber()
  @Min(1)
  chapterIndex: number;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  chapterLabel?: string;

  @IsOptional()
  @IsEnum(ChapterStatus)
  status?: ChapterStatus;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateChapterPageDto)
  pages?: CreateChapterPageDto[];
}
