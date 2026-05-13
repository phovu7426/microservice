// ---------------------------------------------------------------------------
// Module mocks — must come before any import that transitively loads them.
// ---------------------------------------------------------------------------
jest.mock('@package/common', () => ({
  t: (_i18n: any, key: string) => key,
  createPaginationMeta: jest.fn((_opts: any, total: number) => ({ total })),
  parseQueryOptions: jest.fn((q: any) => ({ skip: 0, take: q?.take ?? 20 })),
}));

jest.mock('@package/bootstrap', () => ({ FileLogger: jest.fn() }));

jest.mock('nestjs-i18n', () => ({
  I18nContext: { current: () => ({ lang: 'en' }) },
  I18nService: jest.fn(),
}));

jest.mock('src/types', () => ({
  toPrimaryKey: (v: string) => BigInt(v),
}), { virtual: true });

jest.mock('src/generated/prisma', () => ({ Prisma: {}, PrismaClient: class {} }), { virtual: true });
jest.mock('@prisma/adapter-pg', () => ({ PrismaPg: jest.fn() }));
jest.mock('../../../../../src/modules/review/repositories/review.repository', () => ({
  ReviewRepository: jest.fn(),
}));

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------
import { PublicReviewService } from '../../../../../src/modules/review/public/services/reviews.service';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeMockReviewRepo() {
  return {
    findMany: jest.fn().mockResolvedValue([]),
    count: jest.fn().mockResolvedValue(0),
    aggregateRatingForFilter: jest.fn().mockResolvedValue({ _avg: { rating: 0 }, _count: 0 }),
  };
}

function makeMockRedis() {
  return {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
    incr: jest.fn().mockResolvedValue(1),
    isEnabled: jest.fn().mockReturnValue(true),
  };
}

function buildService() {
  const reviewRepo = makeMockReviewRepo();
  const redis = makeMockRedis();

  const service = new PublicReviewService(reviewRepo as any, redis as any);

  return { service, reviewRepo, redis };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('PublicReviewService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getList()', () => {
    it('returns reviews with stats from DB on cache miss', async () => {
      const { service, reviewRepo, redis } = buildService();
      const reviews = [{ id: 1n, rating: 5 }];
      reviewRepo.findMany.mockResolvedValue(reviews);
      reviewRepo.count.mockResolvedValue(1);
      reviewRepo.aggregateRatingForFilter.mockResolvedValue({ _avg: { rating: 4.5 }, _count: 10 });

      const result = await service.getList({ comicId: 10n });

      expect(result.data).toEqual(reviews);
      expect(result.meta).toEqual({ total: 1 });
      expect(result.stats).toEqual({ average_rating: 4.5, total_reviews: 10 });
      expect(redis.set).toHaveBeenCalled();
    });

    it('returns cached result on cache hit', async () => {
      const { service, reviewRepo, redis } = buildService();
      const cached = { data: [], meta: { total: 0 }, stats: { average_rating: 0, total_reviews: 0 } };
      redis.get.mockResolvedValue(JSON.stringify(cached));

      const result = await service.getList({});

      expect(result).toEqual(cached);
      expect(reviewRepo.findMany).not.toHaveBeenCalled();
    });

    it('applies comicId filter', async () => {
      const { service, reviewRepo } = buildService();
      reviewRepo.findMany.mockResolvedValue([]);

      await service.getList({ comicId: 10n });

      expect(reviewRepo.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ comicId: 10n }),
        expect.anything(),
      );
    });

    it('handles null aggregate values gracefully', async () => {
      const { service, reviewRepo } = buildService();
      reviewRepo.findMany.mockResolvedValue([]);
      reviewRepo.count.mockResolvedValue(0);
      reviewRepo.aggregateRatingForFilter.mockResolvedValue({ _avg: { rating: null }, _count: 0 });

      const result = await service.getList({});

      expect(result.stats).toEqual({ average_rating: 0, total_reviews: 0 });
    });

    it('falls through to DB when redis is disabled', async () => {
      const { service, reviewRepo, redis } = buildService();
      redis.isEnabled.mockReturnValue(false);
      reviewRepo.findMany.mockResolvedValue([]);
      reviewRepo.count.mockResolvedValue(0);

      const result = await service.getList({});

      expect(result.data).toEqual([]);
      expect(reviewRepo.findMany).toHaveBeenCalled();
    });
  });
});
