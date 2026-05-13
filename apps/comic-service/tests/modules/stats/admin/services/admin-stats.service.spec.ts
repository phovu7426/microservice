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

jest.mock('src/generated/prisma', () => ({
  Prisma: {},
  PrismaClient: class {},
}), { virtual: true });

jest.mock('@prisma/adapter-pg', () => ({ PrismaPg: jest.fn() }));
jest.mock('../../../../../src/modules/stats/repositories/stats.repository', () => ({
  StatsRepository: jest.fn(),
}));

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------
import { AdminStatsService } from '../../../../../src/modules/stats/admin/services/admin-stats.service';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeMockStatsRepo() {
  return {
    countComics: jest.fn().mockResolvedValue(0),
    aggregateViews: jest.fn().mockResolvedValue({ _sum: { view_count: 0 } }),
    aggregateFollows: jest.fn().mockResolvedValue({ _sum: { follow_count: 0 } }),
    findTopComics: jest.fn().mockResolvedValue([]),
  };
}

function buildService() {
  const statsRepo = makeMockStatsRepo();
  const service = new AdminStatsService(statsRepo as any);
  return { service, statsRepo };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('AdminStatsService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getDashboard()', () => {
    it('returns aggregated dashboard stats', async () => {
      const { service, statsRepo } = buildService();
      statsRepo.countComics.mockResolvedValue(100);
      statsRepo.aggregateViews.mockResolvedValue({ _sum: { view_count: 50000 } });
      statsRepo.aggregateFollows.mockResolvedValue({ _sum: { follow_count: 3000 } });
      statsRepo.findTopComics.mockResolvedValue([{ id: 1n, title: 'Top' }]);

      const result = await service.getDashboard();

      expect(result).toEqual({
        total_comics: 100,
        total_views: 50000,
        total_follows: 3000,
        top_comics: [{ id: 1n, title: 'Top' }],
      });
    });

    it('handles null sums gracefully', async () => {
      const { service, statsRepo } = buildService();
      statsRepo.countComics.mockResolvedValue(0);
      statsRepo.aggregateViews.mockResolvedValue({ _sum: { view_count: null } });
      statsRepo.aggregateFollows.mockResolvedValue({ _sum: { follow_count: null } });

      const result = await service.getDashboard();

      expect(result.total_views).toBe(0);
      expect(result.total_follows).toBe(0);
    });
  });

  describe('getTopComics()', () => {
    it('returns top comics sorted by views by default', async () => {
      const { service, statsRepo } = buildService();
      statsRepo.findTopComics.mockResolvedValue([{ id: 1n }]);

      const result = await service.getTopComics({});

      expect(result).toEqual({ data: [{ id: 1n }] });
      expect(statsRepo.findTopComics).toHaveBeenCalledWith(
        { stats: { view_count: 'desc' } },
        10,
      );
    });

    it('sorts by follows when requested', async () => {
      const { service, statsRepo } = buildService();
      statsRepo.findTopComics.mockResolvedValue([]);

      await service.getTopComics({ sortBy: 'follows', limit: 5 });

      expect(statsRepo.findTopComics).toHaveBeenCalledWith(
        { stats: { follow_count: 'desc' } },
        5,
      );
    });

    it('sorts by rating when requested', async () => {
      const { service, statsRepo } = buildService();
      statsRepo.findTopComics.mockResolvedValue([]);

      await service.getTopComics({ sortBy: 'rating' });

      expect(statsRepo.findTopComics).toHaveBeenCalledWith(
        { stats: { rating_sum: 'desc' } },
        10,
      );
    });

    it('defaults limit to 10 when invalid', async () => {
      const { service, statsRepo } = buildService();
      statsRepo.findTopComics.mockResolvedValue([]);

      await service.getTopComics({ limit: 'abc' });

      expect(statsRepo.findTopComics).toHaveBeenCalledWith(expect.anything(), 10);
    });
  });
});
