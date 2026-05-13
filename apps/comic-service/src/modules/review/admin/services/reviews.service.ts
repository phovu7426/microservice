import { Injectable, NotFoundException, Optional } from '@nestjs/common';
import { PrimaryKey } from 'src/types';
import { RedisService } from '@package/redis';
import { I18nService } from 'nestjs-i18n';
import { t, createPaginationMeta, parseQueryOptions } from '@package/common';
import { ReviewFilter, ReviewRepository } from '../../repositories/review.repository';

@Injectable()
export class AdminReviewService {
  constructor(
    private readonly reviewRepo: ReviewRepository,
    private readonly i18n: I18nService,
    @Optional() private readonly redis?: RedisService,
  ) {}

  async getList(query: any = {}) {
    const options = parseQueryOptions(query);

    const filter: ReviewFilter = {};
    if (query.comicId) filter.comicId = query.comicId;
    if (query.userId) filter.userId = query.userId;
    if (query.rating) filter.rating = Number(query.rating);

    const skipCount = query.skipCount === true || query.skipCount === 'true';
    const [data, total] = await Promise.all([
      this.reviewRepo.findMany(filter, options),
      skipCount ? Promise.resolve(0) : this.reviewRepo.count(filter),
    ]);

    return { data, meta: createPaginationMeta(options, total) };
  }

  async delete(id: PrimaryKey) {
    const review = await this.reviewRepo.findById(id);
    if (!review) throw new NotFoundException(t(this.i18n, 'comic.REVIEW_NOT_FOUND'));

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
