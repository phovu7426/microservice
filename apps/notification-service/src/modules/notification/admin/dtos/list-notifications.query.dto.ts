import { IsBooleanString, IsEnum, IsOptional, IsString, Matches } from 'class-validator';
import { BaseListQueryDto } from '@package/common';
import { NotificationType } from '../../enums/notification-type.enum';
import { NotificationStatus } from '../../enums/notification-status.enum';

export class ListNotificationsAdminQueryDto extends BaseListQueryDto {
  @IsOptional()
  @IsString()
  @Matches(/^\d{1,20}$/, { message: 'userId must be numeric.' })
  userId?: string;

  @IsOptional()
  @IsEnum(NotificationType)
  type?: NotificationType;

  @IsOptional()
  @IsEnum(NotificationStatus)
  status?: NotificationStatus;

  @IsOptional()
  @IsBooleanString()
  isRead?: string;
}
