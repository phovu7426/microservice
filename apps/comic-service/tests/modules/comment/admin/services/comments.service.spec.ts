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
jest.mock('../../../../../src/modules/comment/repositories/comment.repository', () => ({
  CommentRepository: jest.fn(),
}));

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------
import { NotFoundException } from '@nestjs/common';
import { AdminCommentService } from '../../../../../src/modules/comment/admin/services/comments.service';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeMockCommentRepo() {
  return {
    findMany: jest.fn().mockResolvedValue([]),
    count: jest.fn().mockResolvedValue(0),
    findById: jest.fn(),
    update: jest.fn(),
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
  const commentRepo = makeMockCommentRepo();
  const i18n = makeMockI18n();
  const redis = makeMockRedis();

  const service = new AdminCommentService(
    commentRepo as any,
    i18n as any,
    redis as any,
  );

  return { service, commentRepo, i18n, redis };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('AdminCommentService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // -----------------------------------------------------------------------
  // getList()
  // -----------------------------------------------------------------------
  describe('getList()', () => {
    it('returns paginated list', async () => {
      const { service, commentRepo } = buildService();
      const comments = [{ id: 1n, content: 'Hello' }];
      commentRepo.findMany.mockResolvedValue(comments);
      commentRepo.count.mockResolvedValue(1);

      const result = await service.getList({});

      expect(result.data).toEqual(comments);
      expect(result.meta).toEqual({ total: 1 });
    });

    it('skips count when skipCount is true', async () => {
      const { service, commentRepo } = buildService();
      commentRepo.findMany.mockResolvedValue([]);

      await service.getList({ skipCount: true });

      expect(commentRepo.count).not.toHaveBeenCalled();
    });

    it('applies filters from query', async () => {
      const { service, commentRepo } = buildService();
      commentRepo.findMany.mockResolvedValue([]);

      await service.getList({ comicId: 10n, chapterId: 100n, userId: 1n, status: 'visible' });

      expect(commentRepo.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          comicId: 10n,
          chapterId: 100n,
          userId: 1n,
          status: 'visible',
        }),
        expect.anything(),
      );
    });
  });

  // -----------------------------------------------------------------------
  // updateStatus()
  // -----------------------------------------------------------------------
  describe('updateStatus()', () => {
    it('updates comment status and increments version', async () => {
      const { service, commentRepo, redis } = buildService();
      commentRepo.findById.mockResolvedValue({ id: 1n, status: 'visible' });
      commentRepo.update.mockResolvedValue({ id: 1n, status: 'hidden' });

      const result = await service.updateStatus(1n, 'hidden');

      expect(commentRepo.update).toHaveBeenCalledWith(1n, { status: 'hidden' });
      expect(redis.incr).toHaveBeenCalledWith('comic:public:comments:v');
      expect(result.status).toBe('hidden');
    });

    it('throws NotFoundException when comment not found', async () => {
      const { service, commentRepo } = buildService();
      commentRepo.findById.mockResolvedValue(null);

      await expect(service.updateStatus(999n, 'hidden')).rejects.toThrow(NotFoundException);
    });
  });
});
