import { IsString, IsArray, IsOptional, MaxLength, Matches, ArrayMaxSize, ArrayUnique } from 'class-validator';

export class InternalSendNotificationDto {
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(500)
  @IsString({ each: true })
  @Matches(/^\d{1,20}$/, { each: true, message: 'userIds must be numeric.' })
  userIds: string[];

  @IsString()
  @MaxLength(255)
  title: string;

  @IsString()
  @MaxLength(5000)
  message: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  type?: string;

  @IsOptional()
  data?: Record<string, unknown>;
}
