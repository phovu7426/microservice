import { Module } from '@nestjs/common';
import { EnumModule } from '@package/common';
import * as NotificationEnums from './enums';
import { AdminNotificationController } from './admin/controllers/notification.controller';
import { AdminNotificationService } from './admin/services/notification.service';
import { UserNotificationController } from './user/controllers/notification.controller';
import { UserNotificationService } from './user/services/notification.service';
import { NotificationRepository } from './repositories/notification.repository';
import { FollowersProjectionRepository } from './repositories/followers-projection.repository';

@Module({
  imports: [
    EnumModule.register({ path: 'notifications/enums', enums: NotificationEnums }),
  ],
  controllers: [AdminNotificationController, UserNotificationController],
  providers: [NotificationRepository, FollowersProjectionRepository, AdminNotificationService, UserNotificationService],
  exports: [AdminNotificationService, NotificationRepository, FollowersProjectionRepository],
})
export class NotificationModule {}
