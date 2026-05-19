import { Injectable } from '@nestjs/common';
import { AdminNotificationService } from '../../../modules/notification/admin/services/notification.service';
import { KafkaHandler } from '../interfaces/kafka-handler.interface';

@Injectable()
export class CommentCreatedHandler implements KafkaHandler {
  constructor(private readonly notifService: AdminNotificationService) {}

  async handle(payload: any) {
    const { parent_comment_user_id, user_id, comic_id, comment_id } = payload;
    if (!parent_comment_user_id || parent_comment_user_id === user_id) return;
    await this.notifService.create({
      userId: parent_comment_user_id,
      title: 'Có người trả lời bình luận của bạn',
      message: 'Ai đó đã trả lời bình luận của bạn',
      type: 'info',
      data: { comic_id, comment_id },
    });
  }
}
