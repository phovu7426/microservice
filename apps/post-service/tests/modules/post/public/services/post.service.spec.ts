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

jest.mock('../../../../../src/modules/post/repositories/post.repository', () => ({
  PostRepository: jest.fn(),
}));

jest.mock('../../../../../src/modules/post/enums/post-status.enum', () => ({
  PUBLIC_POST_STATUSES: ['published'],
}));

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------
import { NotFoundException } from '@nestjs/common';
import { PublicPostService } from '../../../../../src/modules/post/public/services/post.service';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeMockPostRepo() {
  return {
    findManyPublic: jest.fn().mockResolvedValue([]),
    count: jest.fn().mockResolvedValue(0),
    findBySlug: jest.fn().mockResolvedValue(null),
  };
}

function makeMockI18n() {
  return {} as any;
}

function makeMockRedis() {
  return {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
    del: jest.fn().mockResolvedValue(undefined),
    incr: jest.fn().mockResolvedValue(1),
    setnx: jest.fn().mockResolvedValue(true),
    hincrby: jest.fn().mockResolvedValue(1),
    isEnabled: jest.fn().mockReturnValue(true),
  };
}

function makePost(overrides: Record<string, any> = {}) {
  return {
    id: 1n,
    name: 'Test Post',
    slug: 'test-post',
    status: 'published',
    categoryLinks: [{ category: { id: 1n, name: 'Cat', slug: 'cat' } }],
    tagLinks: [{ tag: { id: 1n, name: 'Tag', slug: 'tag' } }],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('PublicPostService', () => {
  let service: PublicPostService;
  let postRepo: ReturnType<typeof makeMockPostRepo>;
  let redis: ReturnType<typeof makeMockRedis>;

  beforeEach(() => {
    postRepo = makeMockPostRepo();
    redis = makeMockRedis();
    service = new PublicPostService(postRepo as any, makeMockI18n(), redis as any);
  });

  // ---- getList ----
  describe('getList', () => {
    it('should fetch from DB on cache miss and cache result', async () => {
      postRepo.findManyPublic.mockResolvedValue([makePost()]);
      postRepo.count.mockResolvedValue(1);

      const result = await service.getList({});

      expect(redis.get).toHaveBeenCalled();
      expect(postRepo.findManyPublic).toHaveBeenCalled();
      expect(redis.set).toHaveBeenCalled();
      expect(result.data).toHaveLength(1);
      expect(result.data[0].categories).toBeDefined();
      expect(result.data[0].categoryLinks).toBeUndefined();
    });

    it('should return cached data on cache hit', async () => {
      const cached = { data: [{ id: 1 }], meta: { total: 1 } };
      redis.get.mockResolvedValueOnce('0').mockResolvedValueOnce(JSON.stringify(cached));

      const result = await service.getList({});

      expect(postRepo.findManyPublic).not.toHaveBeenCalled();
      expect(result).toEqual(cached);
    });

    it('should work without redis', async () => {
      const serviceNoRedis = new PublicPostService(postRepo as any, makeMockI18n(), undefined);
      postRepo.findManyPublic.mockResolvedValue([]);
      postRepo.count.mockResolvedValue(0);

      const result = await serviceNoRedis.getList({});
      expect(result.data).toEqual([]);
    });

    it('should apply filter parameters', async () => {
      postRepo.findManyPublic.mockResolvedValue([]);
      postRepo.count.mockResolvedValue(0);

      await service.getList({ search: 'hello', isFeatured: 'true', categoryId: '1' });

      expect(postRepo.findManyPublic).toHaveBeenCalled();
    });
  });

  // ---- getBySlug ----
  describe('getBySlug', () => {
    it('should return transformed post and deduplicate views', async () => {
      const post = makePost();
      postRepo.findBySlug.mockResolvedValue(post);

      const result = await service.getBySlug('test-post', 'user-ip-123');

      expect(postRepo.findBySlug).toHaveBeenCalledWith('test-post', ['published']);
      expect(redis.setnx).toHaveBeenCalledWith(
        expect.stringContaining('post:view:seen:'),
        '1',
        300,
      );
      expect(redis.hincrby).toHaveBeenCalledWith('post:views:buffer', expect.any(String), 1);
      expect(result.categories).toBeDefined();
    });

    it('should not increment view count on duplicate request', async () => {
      const post = makePost();
      postRepo.findBySlug.mockResolvedValue(post);
      redis.setnx.mockResolvedValue(false);

      await service.getBySlug('test-post', 'user-ip-123');

      expect(redis.hincrby).not.toHaveBeenCalled();
    });

    it('should skip view tracking when no requesterKey', async () => {
      postRepo.findBySlug.mockResolvedValue(makePost());

      await service.getBySlug('test-post');

      expect(redis.setnx).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when slug not found', async () => {
      postRepo.findBySlug.mockResolvedValue(null);
      await expect(service.getBySlug('missing')).rejects.toThrow(NotFoundException);
    });

    it('should cache post detail after fetching', async () => {
      postRepo.findBySlug.mockResolvedValue(makePost());

      await service.getBySlug('test-post');

      expect(redis.set).toHaveBeenCalledWith(
        'post:public:detail:test-post',
        expect.any(String),
        120,
      );
    });
  });

  // ---- inflight dedup ----
  describe('inflight deduplication', () => {
    it('should deduplicate concurrent identical requests', async () => {
      postRepo.findManyPublic.mockResolvedValue([]);
      postRepo.count.mockResolvedValue(0);

      const [r1, r2] = await Promise.all([
        service.getList({ page: 1 }),
        service.getList({ page: 1 }),
      ]);

      expect(r1).toEqual(r2);
    });
  });
});
