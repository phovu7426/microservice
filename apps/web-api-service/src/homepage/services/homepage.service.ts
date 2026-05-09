import { Injectable } from '@nestjs/common';
import { ComicClient } from '../../clients/comic.client';
import { PostClient } from '../../clients/post.client';
import { GatewayCacheService } from '../../cache/cache.service';

const TTL = {
  TOP_VIEWED: 420, // 7 min
  POPULAR: 1200, // 20 min
  NEWEST: 120, // 2 min
  RECENT_UPDATED: 120,
  CATEGORIES: 3600, // 1 h
  LATEST_POSTS: 300, // 5 min
};

const CACHE_KEYS = [
  'homepage:comics:top_viewed',
  'homepage:comics:popular',
  'homepage:comics:newest',
  'homepage:comics:recent_updated',
  'homepage:categories',
  'homepage:posts:latest',
];

@Injectable()
export class GatewayHomepageService {
  constructor(
    private readonly comicClient: ComicClient,
    private readonly postClient: PostClient,
    private readonly cache: GatewayCacheService,
  ) {}

  async getHomepageData() {
    // Skip caching empty arrays / null — those come from circuit-open or
    // upstream 5xx and would otherwise lock the homepage into a broken
    // state for the full TTL (up to 12h for categories).
    const nonEmptyArray = (v: unknown) => Array.isArray(v) && v.length > 0;
    const nonNull = (v: unknown) => v != null && v !== '';

    const [
      topViewedComics,
      popularComics,
      newestComics,
      recentUpdateComics,
      comicCategories,
      latestPosts,
    ] = await Promise.all([
      this.cache.getOrSet(
        'homepage:comics:top_viewed',
        () => this.comicClient.getTopViewed(8),
        { ttlSeconds: TTL.TOP_VIEWED, shouldCache: nonEmptyArray },
      ),
      this.cache.getOrSet(
        'homepage:comics:popular',
        () => this.comicClient.getPopular(8),
        { ttlSeconds: TTL.POPULAR, shouldCache: nonEmptyArray },
      ),
      this.cache.getOrSet(
        'homepage:comics:newest',
        () => this.comicClient.getNewest(8),
        { ttlSeconds: TTL.NEWEST, shouldCache: nonEmptyArray },
      ),
      this.cache.getOrSet(
        'homepage:comics:recent_updated',
        () => this.comicClient.getRecentlyUpdated(8),
        { ttlSeconds: TTL.RECENT_UPDATED, shouldCache: nonEmptyArray },
      ),
      this.cache.getOrSet(
        'homepage:categories',
        () => this.comicClient.getCategories(),
        { ttlSeconds: TTL.CATEGORIES, shouldCache: nonEmptyArray },
      ),
      this.cache.getOrSet(
        'homepage:posts:latest',
        () => this.postClient.getLatestPosts(6),
        { ttlSeconds: TTL.LATEST_POSTS, shouldCache: nonEmptyArray },
      ),
    ]);
    // Keep `nonNull` referenced in case future call sites need it.
    void nonNull;

    return {
      top_viewed_comics: topViewedComics,
      trending_comics: topViewedComics,
      popular_comics: popularComics,
      newest_comics: newestComics,
      recent_update_comics: recentUpdateComics,
      comic_categories: comicCategories,
      latest_posts: latestPosts,
    };
  }

  async clearCache(): Promise<void> {
    await Promise.all(CACHE_KEYS.map((k) => this.cache.del(k)));
  }
}
