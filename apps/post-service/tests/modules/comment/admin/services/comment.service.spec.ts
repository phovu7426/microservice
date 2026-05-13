// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------
jest.mock('@package/common', () => ({
  t: (_i18n: any, key: string) => key,
  createPaginationMeta: jest.fn((_opts: any, total: number) => ({ total })),
  parseQueryOptions: jest.fn((q: any) => ({ skip: Number(q?.skip) || 0, take: Number(q?.take) || 10 })),
}));

jest.mock('@package/bootstrap', () => ({ FileLogger: jest.fn() }));

jest.mock('nestjs-i18n', () => ({
  I18nContext: { current: () => ({ lang: 'en' }) },
  I18nService: jest.fn(),
}));

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
import { NotFoundException } from '@nestjs/common';
import { AdminCommentService } from '../../../../../src/modules/comment/admin/services/comment.service';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeMockCommentRepo() {
  return {
    findMany: jest.fn().mockResolvedValue([]),
    count: jest.fn().mockResolvedValue(0),
    findById: jest.fn().mockResolvedValue(null),
    update: jest.fn().mockResolvedValue({ id: 1n, status: 'visible' }),
  };
}

function makeMockI18n() {
  return {} as any;
}

function makeMockRedis() {
  return {
    incr: jest.fn().mockResolvedValue(1),
    isEnabled: jest.fn().mockReturnValue(true),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('AdminCommentService', () => {
  let service: AdminCommentService;
  let commentRepo: ReturnType<typeof makeMockCommentRepo>;
  let redis: ReturnType<typeof makeMockRedis>;

  beforeEach(() => {
    commentRepo = makeMockCommentRepo();
    redis = makeMockRedis();
    service = new AdminCommentService(commentRepo as any, makeMockI18n(), redis as any);
  });

  // ---- getList ----
  describe('getList', () => {
    it('should return paginated list', async () => {
      const comments = [{ id: 1n, content: 'hi' }];
      commentRepo.findMany.mockResolvedValue(comments);
      commentRepo.count.mockResolvedValue(1);

      const result = await service.getList({});

      expect(result.data).toEqual(comments);
      expect(result.meta).toEqual({ total: 1 });
    });

    it('should skip count when skipCount is true', async () => {
      commentRepo.findMany.mockResolvedValue([]);
      const result = await service.getList({ skipCount: 'true' });

      expect(commentRepo.count).not.toHaveBeenCalled();
      expect(result.meta).toEqual({ total: 0 });
    });

    it('should apply postId filter', async () => {
      commentRepo.findMany.mockResolvedValue([]);
      await service.getList({ postId: '1' });
      expect(commentRepo.findMany).toHaveBeenCalled();
    });

    it('should apply status filter', async () => {
      commentRepo.findMany.mockResolvedValue([]);
      await service.getList({ status: 'hidden' });
      expect(commentRepo.findMany).toHaveBeenCalled();
    });
  });

  // ---- updateStatus ----
  describe('updateStatus', () => {
    it('should update comment status and increment version', async () => {
      commentRepo.findById.mockResolvedValue({ id: 1n, status: 'hidden' });

      const result = await service.updateStatus(1n, 'visible');

      expect(commentRepo.update).toHaveBeenCalledWith(1n, { status: 'visible' });
      expect(redis.incr).toHaveBeenCalledWith('post:public:comments:v');
      expect(result).toEqual({ id: 1n, status: 'visible' });
    });

    it('should throw NotFoundException when comment not found', async () => {
      commentRepo.findById.mockResolvedValue(null);
      await expect(service.updateStatus(999n, 'visible')).rejects.toThrow(NotFoundException);
    });
  });
});
