import {
  ArrayMaxSize,
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

export class SendNotificationDto {
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  // Cap broadcast size — without it an admin (or anyone bypassing the UI)
  // can blast millions of notifications and block the queue worker.
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
  @IsObject()
  data?: Record<string, unknown>;
}
