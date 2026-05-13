import { IsEnum, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { BasicStatus } from '../../../../common/enums/status.enum';

export class CreateFaqDto {
  @IsString()
  @MaxLength(500)
  question: string;

  @IsString()
  @MaxLength(20_000)
  answer: string;

  @IsOptional()
  @IsEnum(BasicStatus)
  status?: BasicStatus;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}
