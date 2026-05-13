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
import { PublicCommentService } from '../../../../../src/modules/comment/public/services/comments.service';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeMockCommentRepo() {
  return {
    findManyWithReplies: jest.fn().mockResolvedValue([]),
    count: jest.fn().mockResolvedValue(0),
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
  const commentRepo = makeMockCommentRepo();
  const redis = makeMockRedis();

  const service = new PublicCommentService(commentRepo as any, redis as any);

  return { service, commentRepo, redis };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('PublicCommentService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getList()', () => {
    it('returns comments from DB on cache miss', async () => {
      const { service, commentRepo, redis } = buildService();
      const comments = [{ id: 1n, content: 'Great' }];
      commentRepo.findManyWithReplies.mockResolvedValue(comments);
      commentRepo.count.mockResolvedValue(1);

      const result = await service.getList({ comicId: 10n });

      expect(result.data).toEqual(comments);
      expect(result.meta).toEqual({ total: 1 });
      expect(redis.set).toHaveBeenCalled();
    });

    it('returns cached result on cache hit', async () => {
      const { service, commentRepo, redis } = buildService();
      const cached = { data: [{ id: 1, content: 'Cached' }], meta: { total: 1 } };
      redis.get.mockResolvedValue(JSON.stringify(cached));

      const result = await service.getList({ comicId: 10n });

      expect(result).toEqual(cached);
      expect(commentRepo.findManyWithReplies).not.toHaveBeenCalled();
    });

    it('applies comicId and chapterId filters with status=visible and parentId=null', async () => {
      const { service, commentRepo } = buildService();
      commentRepo.findManyWithReplies.mockResolvedValue([]);

      await service.getList({ comicId: 10n, chapterId: 100n });

      expect(commentRepo.findManyWithReplies).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'visible',
          parentId: null,
          comicId: 10n,
          chapterId: 100n,
        }),
        expect.anything(),
      );
    });

    it('falls through to DB when redis is disabled', async () => {
      const { service, commentRepo, redis } = buildService();
      redis.isEnabled.mockReturnValue(false);
      commentRepo.findManyWithReplies.mockResolvedValue([]);
      commentRepo.count.mockResolvedValue(0);

      const result = await service.getList({});

      expect(result.data).toEqual([]);
      expect(commentRepo.findManyWithReplies).toHaveBeenCalled();
    });
  });
});
