import { Injectable } from '@nestjs/common';
import { AdminNotificationService } from '../../modules/notification/admin/services/notification.service';
import { FollowersProjectionRepository } from '../../modules/notification/repositories/followers-projection.repository';
import { KafkaHandler } from '../interfaces/kafka-handler.interface';

const NUMERIC_RE = /^\d{1,20}$/;

@Injectable()
export class ChapterPublishedHandler implements KafkaHandler {
  constructor(
    private readonly followersProjectionRepo: FollowersProjectionRepository,
    private readonly notifService: AdminNotificationService,
  ) {}

  async handle(payload: any) {
    const { comic_id, comic_title, comic_slug, chapter_label } = payload ?? {};

    if (!comic_id || !NUMERIC_RE.test(String(comic_id))) return;
    if (typeof comic_title !== 'string' || typeof chapter_label !== 'string') return;

    const followers = await this.followersProjectionRepo.findByComicId(BigInt(comic_id));
    if (!followers.length) return;

    const batchSize = 500;
    let failedBatches = 0;
    for (let i = 0; i < followers.length; i += batchSize) {
      const batch = followers.slice(i, i + batchSize);
      try {
        await this.notifService.createMany(
          batch.map((f) => ({
            userId: f.userId,
            title: `${comic_title} - ${chapter_label}`,
            message: `Chương mới đã được cập nhật: ${chapter_label}`,
            type: 'info',
            data: { comic_id: String(comic_id), comic_slug, chapter_label },
          })),
        );
      } catch {
        failedBatches++;
      }
    }
    if (failedBatches > 0) {
      throw new Error(
        `chapter.published: ${failedBatches} batch(es) failed for comic ${comic_id}`,
      );
    }
  }
}
