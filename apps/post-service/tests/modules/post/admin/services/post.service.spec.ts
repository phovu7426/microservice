// ---------------------------------------------------------------------------
// Module mocks -- must come before any import that transitively loads them.
// ---------------------------------------------------------------------------
jest.mock('@package/common', () => ({
  t: (_i18n: any, key: string) => key,
  SlugHelper: {
    uniqueSlug: jest.fn().mockResolvedValue('generated-slug'),
  },
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

// Mock the generated Prisma client used by PrismaService
jest.mock('src/generated/prisma', () => {
  class PrismaClientKnownRequestError extends Error {
    code: string;
    constructor(message: string, opts: { code: string; clientVersion: string }) {
      super(message);
      this.code = opts.code;
    }
  }
  return {
    PrismaClient: class {},
    Prisma: { PrismaClientKnownRequestError },
  };
}, { virtual: true });

jest.mock('@prisma/adapter-pg', () => ({
  PrismaPg: jest.fn(),
}), { virtual: true });

jest.mock('src/types', () => ({
  toPrimaryKey: (v: string) => BigInt(v),
}), { virtual: true });

// Mock the repository to prevent transitive Prisma resolution
jest.mock('../../../../../src/modules/post/repositories/post.repository', () => ({
  PostRepository: jest.fn(),
}));

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AdminPostService } from '../../../../../src/modules/post/admin/services/post.service';
import { Prisma } from 'src/generated/prisma';
import { SlugHelper } from '@package/common';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeMockPostRepo() {
  return {
    findMany: jest.fn().mockResolvedValue([]),
    findSimpleMany: jest.fn().mockResolvedValue([]),
    count: jest.fn().mockResolvedValue(0),
    findById: jest.fn().mockResolvedValue(null),
    findBySlugSimple: jest.fn().mockResolvedValue(null),
    createWithRelations: jest.fn().mockResolvedValue({ id: 1n, slug: 'test-post' }),
    updateWithRelations: jest.fn().mockResolvedValue(undefined),
    delete: jest.fn().mockResolvedValue(undefined),
    findBySlug: jest.fn().mockResolvedValue(null),
  };
}

function makeMockI18n() {
  return {} as any;
}

function makeMockRedis() {
  return {
    del: jest.fn().mockResolvedValue(undefined),
    incr: jest.fn().mockResolvedValue(1),
    isEnabled: jest.fn().mockReturnValue(true),
  };
}

function makePost(overrides: Record<string, any> = {}) {
  return {
    id: 1n,
    name: 'Test Post',
    slug: 'test-post',
    status: 'published',
    categoryLinks: [{ category: { id: 1n, name: 'Cat1', slug: 'cat1' } }],
    tagLinks: [{ tag: { id: 1n, name: 'Tag1', slug: 'tag1' } }],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('AdminPostService', () => {
  let service: AdminPostService;
  let postRepo: ReturnType<typeof makeMockPostRepo>;
  let redis: ReturnType<typeof makeMockRedis>;

  beforeEach(() => {
    postRepo = makeMockPostRepo();
    redis = makeMockRedis();
    service = new AdminPostService(postRepo as any, makeMockI18n(), redis as any);
  });

  // ---- getList ----
  describe('getList', () => {
    it('should return paginated list with transform', async () => {
      const post = makePost();
      postRepo.findMany.mockResolvedValue([post]);
      postRepo.count.mockResolvedValue(1);

      const result = await service.getList({});

      expect(postRepo.findMany).toHaveBeenCalled();
      expect(postRepo.count).toHaveBeenCalled();
      expect(result.data).toHaveLength(1);
      expect(result.data[0].categories).toEqual([{ id: 1n, name: 'Cat1', slug: 'cat1' }]);
      expect(result.data[0].tags).toEqual([{ id: 1n, name: 'Tag1', slug: 'tag1' }]);
      expect(result.data[0].categoryLinks).toBeUndefined();
      expect(result.data[0].tagLinks).toBeUndefined();
    });

    it('should skip count when skipCount is true', async () => {
      postRepo.findMany.mockResolvedValue([]);
      const result = await service.getList({ skipCount: true });

      expect(postRepo.count).not.toHaveBeenCalled();
      expect(result.meta).toEqual({ total: 0 });
    });

    it('should apply search filter', async () => {
      postRepo.findMany.mockResolvedValue([]);
      await service.getList({ search: 'hello' });
      expect(postRepo.findMany).toHaveBeenCalled();
    });
  });

  // ---- getSimpleList ----
  describe('getSimpleList', () => {
    it('should return simple list with capped limit', async () => {
      postRepo.findSimpleMany.mockResolvedValue([{ id: 1n, name: 'p', slug: 's', status: 'draft' }]);
      const result = await service.getSimpleList({ limit: 500 });
      expect(postRepo.findSimpleMany).toHaveBeenCalledWith(expect.any(Object), 200);
      expect(result.data).toHaveLength(1);
    });

    it('should default limit to 50', async () => {
      postRepo.findSimpleMany.mockResolvedValue([]);
      await service.getSimpleList({});
      expect(postRepo.findSimpleMany).toHaveBeenCalledWith(expect.any(Object), 50);
    });
  });

  // ---- getOne ----
  describe('getOne', () => {
    it('should return transformed post when found', async () => {
      postRepo.findById.mockResolvedValue(makePost());
      const result = await service.getOne(1n);
      expect(result).toHaveProperty('categories');
      expect(result).not.toHaveProperty('categoryLinks');
    });

    it('should throw NotFoundException when post not found', async () => {
      postRepo.findById.mockResolvedValue(null);
      await expect(service.getOne(1n)).rejects.toThrow(NotFoundException);
    });
  });

  // ---- create ----
  describe('create', () => {
    it('should create post with slug and clear caches', async () => {
      const post = makePost();
      postRepo.createWithRelations.mockResolvedValue(post);

      const dto = { name: 'Test', categoryIds: [1n], tagIds: [1n] } as any;
      const result = await service.create(dto, 1n);

      expect(SlugHelper.uniqueSlug).toHaveBeenCalledWith('Test', expect.any(Object));
      expect(postRepo.createWithRelations).toHaveBeenCalled();
      expect(redis.del).toHaveBeenCalledWith('post:public:detail:generated-slug');
      expect(redis.incr).toHaveBeenCalledWith('post:public:list:v');
      expect(result).toHaveProperty('categories');
    });

    it('should retry on P2002 slug collision up to 2 times', async () => {
      const P2002 = new (Prisma.PrismaClientKnownRequestError as any)('dup', {
        code: 'P2002',
        clientVersion: '0',
      });

      postRepo.createWithRelations
        .mockRejectedValueOnce(P2002)
        .mockRejectedValueOnce(P2002)
        .mockResolvedValueOnce(makePost());

      const result = await service.create({ name: 'Test' } as any);
      expect(postRepo.createWithRelations).toHaveBeenCalledTimes(3);
      expect(result).toHaveProperty('categories');
    });

    it('should throw BadRequestException after exhausting P2002 retries', async () => {
      const P2002 = new (Prisma.PrismaClientKnownRequestError as any)('dup', {
        code: 'P2002',
        clientVersion: '0',
      });

      postRepo.createWithRelations
        .mockRejectedValueOnce(P2002)
        .mockRejectedValueOnce(P2002)
        .mockRejectedValueOnce(P2002);

      await expect(service.create({ name: 'Test' } as any)).rejects.toThrow(BadRequestException);
    });

    it('should rethrow non-P2002 errors immediately', async () => {
      postRepo.createWithRelations.mockRejectedValue(new Error('DB down'));
      await expect(service.create({ name: 'Test' } as any)).rejects.toThrow('DB down');
    });
  });

  // ---- update ----
  describe('update', () => {
    it('should update and regenerate slug when name changes', async () => {
      const existing = makePost({ name: 'Old Name' });
      postRepo.findById
        .mockResolvedValueOnce(existing)   // getOne in update
        .mockResolvedValueOnce(existing);  // getOne at end

      await service.update(1n, { name: 'New Name' } as any, 1n);

      expect(SlugHelper.uniqueSlug).toHaveBeenCalledWith('New Name', expect.any(Object), 1n);
      expect(postRepo.updateWithRelations).toHaveBeenCalled();
      expect(redis.incr).toHaveBeenCalledWith('post:public:list:v');
    });

    it('should not regenerate slug when name is unchanged', async () => {
      const existing = makePost({ name: 'Same Name' });
      postRepo.findById.mockResolvedValue(existing);

      (SlugHelper.uniqueSlug as jest.Mock).mockClear();
      await service.update(1n, { content: 'updated' } as any);

      expect(SlugHelper.uniqueSlug).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException on P2002 during update', async () => {
      postRepo.findById.mockResolvedValue(makePost());

      const P2002 = new (Prisma.PrismaClientKnownRequestError as any)('dup', {
        code: 'P2002',
        clientVersion: '0',
      });
      postRepo.updateWithRelations.mockRejectedValue(P2002);

      await expect(service.update(1n, { slug: 'taken' } as any)).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException if post does not exist', async () => {
      postRepo.findById.mockResolvedValue(null);
      await expect(service.update(999n, { name: 'x' } as any)).rejects.toThrow(NotFoundException);
    });
  });

  // ---- delete ----
  describe('delete', () => {
    it('should delete and clear caches', async () => {
      postRepo.findById.mockResolvedValue(makePost({ slug: 'my-slug' }));
      const result = await service.delete(1n);

      expect(postRepo.delete).toHaveBeenCalledWith(1n);
      expect(redis.del).toHaveBeenCalledWith('post:public:detail:my-slug');
      expect(redis.incr).toHaveBeenCalledWith('post:public:list:v');
      expect(result).toEqual({ success: true });
    });

    it('should throw NotFoundException if post not found', async () => {
      postRepo.findById.mockResolvedValue(null);
      await expect(service.delete(999n)).rejects.toThrow(NotFoundException);
    });
  });

  // ---- clearPostCaches resilience ----
  describe('clearPostCaches', () => {
    it('should not throw when redis fails', async () => {
      redis.del.mockRejectedValue(new Error('Redis down'));
      postRepo.findById.mockResolvedValue(makePost());
      const result = await service.delete(1n);
      expect(result).toEqual({ success: true });
    });
  });
});
