import { Injectable } from '@nestjs/common';
import { Prisma } from 'src/generated/prisma';
import { RedisService } from '@package/redis';
import { StatsRepository } from '../../repositories/stats.repository';

@Injectable()
export class AdminStatsService {
  constructor(
    private readonly statsRepo: StatsRepository,
    private readonly redis: RedisService,
  ) {}

  async getDashboard() {
    if (this.redis?.isEnabled()) {
      const cached = await this.redis.get('comic:admin:dashboard');
      if (cached) return JSON.parse(cached);
    }

    const [totalComics, totalViews, totalFollows] = await Promise.all([
      this.statsRepo.countComics(),
      this.statsRepo.aggregateViews(),
      this.statsRepo.aggregateFollows(),
    ]);

    const topComics = await this.statsRepo.findTopComics({ stats: { view_count: 'desc' } }, 10);

    const result = {
      total_comics: totalComics,
      total_views: totalViews._sum?.view_count || 0,
      total_follows: totalFollows._sum?.follow_count || 0,
      top_comics: topComics,
    };

    if (this.redis?.isEnabled()) {
      await this.redis.set(
        'comic:admin:dashboard',
        JSON.stringify(result, (_, v) => (typeof v === 'bigint' ? String(v) : v)),
        60,
      );
    }

    return result;
  }

  async getTopComics(query: any) {
    const limit = Math.max(Number(query.limit) || 10, 1);
    const sortBy = query.sort_by || 'views';

    const orderBy: Prisma.ComicOrderByWithRelationInput =
      sortBy === 'follows'
        ? { stats: { follow_count: 'desc' } }
        : sortBy === 'rating'
          ? { stats: { rating_sum: 'desc' } }
          : { stats: { view_count: 'desc' } };

    const data = await this.statsRepo.findTopComics(orderBy, limit);
    return { data };
  }
}
