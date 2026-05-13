// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------
jest.mock('@package/common', () => ({
  createPaginationMeta: jest.fn((_opts: any, total: number) => ({ total })),
  parseQueryOptions: jest.fn((_q: any, _opts?: any) => ({ skip: 0, take: 20 })),
}));

jest.mock('@package/bootstrap', () => ({ FileLogger: jest.fn() }));

jest.mock('@package/redis', () => ({
  RedisService: jest.fn(),
}));

jest.mock('src/generated/prisma', () => ({
  PrismaClient: class {},
  Prisma: {},
}), { virtual: true });

jest.mock('@prisma/adapter-pg', () => ({
  PrismaPg: jest.fn(),
}), { virtual: true });

jest.mock('src/types', () => ({
  toPrimaryKey: (v: string) => BigInt(v),
}), { virtual: true });

jest.mock('../../../../../src/modules/comment/repositories/comment.repository', () => ({
  CommentRepository: jest.fn(),
}));

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------
import { BadRequestException } from '@nestjs/common';
import { PublicCommentService } from '../../../../../src/modules/comment/public/services/comment.service';

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
    set: jest.fn().mockResolvedValue(undefined),
    isEnabled: jest.fn().mockReturnValue(true),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('PublicCommentService', () => {
  let service: PublicCommentService;
  let commentRepo: ReturnType<typeof makeMockCommentRepo>;
  let redis: ReturnType<typeof makeMockRedis>;

  beforeEach(() => {
    commentRepo = makeMockCommentRepo();
    redis = makeMockRedis();
    service = new PublicCommentService(commentRepo as any, redis as any);
  });

  // ---- getList ----
  describe('getList', () => {
    it('should throw BadRequestException when postId is missing', async () => {
      await expect(service.getList({})).rejects.toThrow(BadRequestException);
    });

    it('should return comments for a given postId', async () => {
      const comments = [{ id: 1n, content: 'hello', replies: [] }];
      commentRepo.findManyWithReplies.mockResolvedValue(comments);
      commentRepo.count.mockResolvedValue(1);

      const result = await service.getList({ postId: '1' });

      expect(commentRepo.findManyWithReplies).toHaveBeenCalled();
      expect(result.data).toEqual(comments);
      expect(result.meta).toEqual({ total: 1 });
    });

    it('should use cache on hit', async () => {
      const cached = { data: [{ id: 1 }], meta: { total: 1 } };
      redis.get
        .mockResolvedValueOnce('5')  // version
        .mockResolvedValueOnce(JSON.stringify(cached)); // cached data

      const result = await service.getList({ postId: '1' });

      expect(commentRepo.findManyWithReplies).not.toHaveBeenCalled();
      expect(result).toEqual(cached);
    });

    it('should cache result after DB fetch', async () => {
      commentRepo.findManyWithReplies.mockResolvedValue([]);
      commentRepo.count.mockResolvedValue(0);

      await service.getList({ postId: '1' });

      expect(redis.set).toHaveBeenCalledWith(
        expect.stringContaining('post:public:comments:'),
        expect.any(String),
        60,
      );
    });

    it('should work without redis', async () => {
      const serviceNoRedis = new PublicCommentService(commentRepo as any, undefined);
      commentRepo.findManyWithReplies.mockResolvedValue([]);
      commentRepo.count.mockResolvedValue(0);

      const result = await serviceNoRedis.getList({ postId: '1' });
      expect(result.data).toEqual([]);
    });
  });
});
