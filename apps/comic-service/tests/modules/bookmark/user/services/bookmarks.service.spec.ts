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
jest.mock('../../../../../src/modules/bookmark/repositories/bookmark.repository', () => ({
  BookmarkRepository: jest.fn(),
}));

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { UserBookmarkService } from '../../../../../src/modules/bookmark/user/services/bookmarks.service';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeMockBookmarkRepo() {
  return {
    findMany: jest.fn().mockResolvedValue([]),
    count: jest.fn().mockResolvedValue(0),
    findById: jest.fn(),
    upsert: jest.fn(),
    delete: jest.fn(),
  };
}

function makeMockI18n() {
  return { t: jest.fn((key: string) => key) };
}

function buildService() {
  const bookmarkRepo = makeMockBookmarkRepo();
  const i18n = makeMockI18n();

  const service = new UserBookmarkService(bookmarkRepo as any, i18n as any);

  return { service, bookmarkRepo, i18n };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('UserBookmarkService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getList()', () => {
    it('returns paginated bookmarks scoped to user', async () => {
      const { service, bookmarkRepo } = buildService();
      const bookmarks = [{ id: 1n, user_id: 1n, chapter_id: 10n }];
      bookmarkRepo.findMany.mockResolvedValue(bookmarks);
      bookmarkRepo.count.mockResolvedValue(1);

      const result = await service.getList(1n, {});

      expect(result.data).toEqual(bookmarks);
      expect(bookmarkRepo.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 1n }),
        expect.anything(),
      );
    });

    it('filters by chapterId when provided', async () => {
      const { service, bookmarkRepo } = buildService();
      bookmarkRepo.findMany.mockResolvedValue([]);

      await service.getList(1n, { chapterId: 100n });

      expect(bookmarkRepo.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ chapterId: 100n }),
        expect.anything(),
      );
    });
  });

  describe('create()', () => {
    it('upserts a bookmark', async () => {
      const { service, bookmarkRepo } = buildService();
      const bookmark = { id: 1n, user_id: 1n, chapter_id: 10n, page_number: 5 };
      bookmarkRepo.upsert.mockResolvedValue(bookmark);

      const result = await service.create(1n, { chapterId: 10n, pageNumber: 5 } as any);

      expect(result).toEqual(bookmark);
      expect(bookmarkRepo.upsert).toHaveBeenCalledWith({
        userId: 1n,
        chapterId: 10n,
        pageNumber: 5,
      });
    });
  });

  describe('delete()', () => {
    it('deletes own bookmark', async () => {
      const { service, bookmarkRepo } = buildService();
      bookmarkRepo.findById.mockResolvedValue({ id: 1n, user_id: 1n });

      const result = await service.delete(1n, 1n);

      expect(result).toEqual({ success: true });
      expect(bookmarkRepo.delete).toHaveBeenCalledWith(1n);
    });

    it('throws NotFoundException when bookmark not found', async () => {
      const { service, bookmarkRepo } = buildService();
      bookmarkRepo.findById.mockResolvedValue(null);

      await expect(service.delete(1n, 999n)).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when not owner', async () => {
      const { service, bookmarkRepo } = buildService();
      bookmarkRepo.findById.mockResolvedValue({ id: 1n, user_id: 2n });

      await expect(service.delete(1n, 1n)).rejects.toThrow(ForbiddenException);
    });
  });
});
