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
jest.mock('../../../../../src/modules/reading-history/repositories/reading-history.repository', () => ({
  ReadingHistoryRepository: jest.fn(),
}));

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------
import { UserReadingHistoryService } from '../../../../../src/modules/reading-history/user/services/reading-history.service';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeMockHistoryRepo() {
  return {
    findMany: jest.fn().mockResolvedValue([]),
    count: jest.fn().mockResolvedValue(0),
    upsert: jest.fn(),
    deleteByUserComic: jest.fn(),
  };
}

function buildService() {
  const historyRepo = makeMockHistoryRepo();
  const service = new UserReadingHistoryService(historyRepo as any);
  return { service, historyRepo };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('UserReadingHistoryService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getList()', () => {
    it('returns paginated history for user', async () => {
      const { service, historyRepo } = buildService();
      const history = [{ id: 1n, user_id: 1n, comic_id: 10n }];
      historyRepo.findMany.mockResolvedValue(history);
      historyRepo.count.mockResolvedValue(1);

      const result = await service.getList(1n, {});

      expect(result.data).toEqual(history);
      expect(historyRepo.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 1n }),
        expect.anything(),
      );
    });
  });

  describe('upsert()', () => {
    it('upserts reading history entry', async () => {
      const { service, historyRepo } = buildService();
      const entry = { id: 1n, user_id: 1n, comic_id: 10n, chapter_id: 100n };
      historyRepo.upsert.mockResolvedValue(entry);

      const result = await service.upsert(1n, 10n, 100n);

      expect(result).toEqual(entry);
      expect(historyRepo.upsert).toHaveBeenCalledWith(1n, 10n, 100n);
    });
  });

  describe('clear()', () => {
    it('deletes history for user+comic and returns success', async () => {
      const { service, historyRepo } = buildService();

      const result = await service.clear(1n, 10n);

      expect(result).toEqual({ success: true });
      expect(historyRepo.deleteByUserComic).toHaveBeenCalledWith({
        userId: 1n,
        comicId: 10n,
      });
    });
  });
});
