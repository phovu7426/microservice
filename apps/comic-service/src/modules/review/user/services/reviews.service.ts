import { Injectable, NotFoundException, ForbiddenException, Optional } from '@nestjs/common';
import { PrimaryKey } from 'src/types';
import { RedisService } from '@package/redis';
import { I18nService } from 'nestjs-i18n';
import { t } from '@package/common';
import { CreateReviewDto } from '../dtos/create-review.dto';
import { ReviewRepository } from '../../repositories/review.repository';

@Injectable()
export class UserReviewService {
  constructor(
    private readonly reviewRepo: ReviewRepository,
    private readonly i18n: I18nService,
    @Optional() private readonly redis?: RedisService,
  ) {}

  async createOrUpdate(userId: PrimaryKey, dto: CreateReviewDto) {
    const review = await this.reviewRepo.upsert(userId, dto.comicId, {
      rating: dto.rating,
      content: dto.content,
    });

    await this.reviewRepo.syncRatingStats(dto.comicId);
    await this.incrementVersion('comic:public:reviews:v');
    return review;
  }

  async delete(userId: PrimaryKey, id: PrimaryKey) {
    const review = await this.reviewRepo.findById(id);
    if (!review) throw new NotFoundException(t(this.i18n, 'comic.REVIEW_NOT_FOUND'));
    if (String(review.userId) !== String(userId)) throw new ForbiddenException(t(this.i18n, 'comic.FORBIDDEN'));

    await this.reviewRepo.delete(id);
    await this.reviewRepo.syncRatingStats(review.comicId);
    await this.incrementVersion('comic:public:reviews:v');
    return { success: true };
  }

  private async incrementVersion(key: string): Promise<void> {
    try {
      if (this.redis?.isEnabled()) {
        await this.redis.incr(key);
      }
    } catch {}
  }
}
