import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { Internal, InternalGuard } from '@package/common';
import { AdminNotificationService } from '../../modules/notification/admin/services/notification.service';
import { InternalSendNotificationDto } from '../dtos/send-notification.dto';

@Internal()
@UseGuards(InternalGuard)
@Controller('internal/notifications')
export class InternalNotificationController {
  constructor(private readonly notificationService: AdminNotificationService) {}

  @Post('send')
  async send(@Body() dto: InternalSendNotificationDto) {
    return this.notificationService.send({
      user_ids: dto.user_ids,
      title: dto.title,
      message: dto.message,
      type: dto.type,
      data: dto.data,
    });
  }
}
