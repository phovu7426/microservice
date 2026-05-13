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
import { NotFoundException } from '@nestjs/common';
import { AdminReviewService } from '../../../../../src/modules/review/admin/services/reviews.service';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeMockReviewRepo() {
  return {
    findMany: jest.fn().mockResolvedValue([]),
    count: jest.fn().mockResolvedValue(0),
    findById: jest.fn(),
    delete: jest.fn(),
    syncRatingStats: jest.fn(),
  };
}

function makeMockRedis() {
  return {
    incr: jest.fn().mockResolvedValue(1),
    isEnabled: jest.fn().mockReturnValue(true),
  };
}

function makeMockI18n() {
  return { t: jest.fn((key: string) => key) };
}

function buildService() {
  const reviewRepo = makeMockReviewRepo();
  const i18n = makeMockI18n();
  const redis = makeMockRedis();

  const service = new AdminReviewService(
    reviewRepo as any,
    i18n as any,
    redis as any,
  );

  return { service, reviewRepo, i18n, redis };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('AdminReviewService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // -----------------------------------------------------------------------
  // getList()
  // -----------------------------------------------------------------------
  describe('getList()', () => {
    it('returns paginated list', async () => {
      const { service, reviewRepo } = buildService();
      const reviews = [{ id: 1n, rating: 5 }];
      reviewRepo.findMany.mockResolvedValue(reviews);
      reviewRepo.count.mockResolvedValue(1);

      const result = await service.getList({});

      expect(result.data).toEqual(reviews);
      expect(result.meta).toEqual({ total: 1 });
    });

    it('skips count when skipCount is true', async () => {
      const { service, reviewRepo } = buildService();
      reviewRepo.findMany.mockResolvedValue([]);

      await service.getList({ skipCount: true });

      expect(reviewRepo.count).not.toHaveBeenCalled();
    });

    it('applies filters from query', async () => {
      const { service, reviewRepo } = buildService();
      reviewRepo.findMany.mockResolvedValue([]);

      await service.getList({ comicId: 10n, userId: 1n, rating: '5' });

      expect(reviewRepo.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          comicId: 10n,
          userId: 1n,
          rating: 5,
        }),
        expect.anything(),
      );
    });
  });

  // -----------------------------------------------------------------------
  // delete()
  // -----------------------------------------------------------------------
  describe('delete()', () => {
    it('deletes review, syncs stats, and increments version', async () => {
      const { service, reviewRepo, redis } = buildService();
      reviewRepo.findById.mockResolvedValue({ id: 1n, comic_id: 10n });

      const result = await service.delete(1n);

      expect(result).toEqual({ success: true });
      expect(reviewRepo.delete).toHaveBeenCalledWith(1n);
      expect(reviewRepo.syncRatingStats).toHaveBeenCalledWith(10n);
      expect(redis.incr).toHaveBeenCalledWith('comic:public:reviews:v');
    });

    it('throws NotFoundException when review not found', async () => {
      const { service, reviewRepo } = buildService();
      reviewRepo.findById.mockResolvedValue(null);

      await expect(service.delete(999n)).rejects.toThrow(NotFoundException);
    });
  });
});
