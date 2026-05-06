import { Module } from '@nestjs/common';
import { NotificationModule } from '../modules/notification/notification.module';
import { InternalNotificationController } from './controllers/notification.controller';

@Module({
  imports: [NotificationModule],
  controllers: [InternalNotificationController],
})
export class InternalModule {}
