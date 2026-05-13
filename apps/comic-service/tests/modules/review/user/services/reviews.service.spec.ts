// ---------------------------------------------------------------------------
// Module mocks — must come before any import that transitively loads them.
// ---------------------------------------------------------------------------
jest.mock('@package/common', () => ({
  t: (_i18n: any, key: string) => key,
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
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { UserReviewService } from '../../../../../src/modules/review/user/services/reviews.service';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeMockReviewRepo() {
  return {
    upsert: jest.fn(),
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

  const service = new UserReviewService(reviewRepo as any, i18n as any, redis as any);

  return { service, reviewRepo, i18n, redis };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('UserReviewService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createOrUpdate()', () => {
    it('upserts review and syncs rating stats', async () => {
      const { service, reviewRepo, redis } = buildService();
      const review = { id: 1n, user_id: 1n, comic_id: 10n, rating: 5 };
      reviewRepo.upsert.mockResolvedValue(review);

      const result = await service.createOrUpdate(1n, { comicId: 10n, rating: 5, content: 'Great!' } as any);

      expect(result).toEqual(review);
      expect(reviewRepo.upsert).toHaveBeenCalledWith(1n, 10n, { rating: 5, content: 'Great!' });
      expect(reviewRepo.syncRatingStats).toHaveBeenCalledWith(10n);
      expect(redis.incr).toHaveBeenCalledWith('comic:public:reviews:v');
    });
  });

  describe('delete()', () => {
    it('deletes own review and syncs rating stats', async () => {
      const { service, reviewRepo, redis } = buildService();
      reviewRepo.findById.mockResolvedValue({ id: 1n, user_id: 1n, comic_id: 10n });

      const result = await service.delete(1n, 1n);

      expect(result).toEqual({ success: true });
      expect(reviewRepo.delete).toHaveBeenCalledWith(1n);
      expect(reviewRepo.syncRatingStats).toHaveBeenCalledWith(10n);
      expect(redis.incr).toHaveBeenCalledWith('comic:public:reviews:v');
    });

    it('throws NotFoundException when review not found', async () => {
      const { service, reviewRepo } = buildService();
      reviewRepo.findById.mockResolvedValue(null);

      await expect(service.delete(1n, 999n)).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when not owner', async () => {
      const { service, reviewRepo } = buildService();
      reviewRepo.findById.mockResolvedValue({ id: 1n, user_id: 2n });

      await expect(service.delete(1n, 1n)).rejects.toThrow(ForbiddenException);
    });
  });
});
