// ---------------------------------------------------------------------------
// Module mocks — must come before any import that transitively loads them.
// ---------------------------------------------------------------------------
jest.mock('src/types', () => ({ toPrimaryKey: (v: any) => BigInt(v) }), { virtual: true });
jest.mock('src/generated/prisma', () => ({ PrismaClient: class {}, Prisma: {} }), { virtual: true });
jest.mock('@prisma/adapter-pg', () => ({ PrismaPg: jest.fn() }));
jest.mock('@package/common', () => ({
  parseQueryOptions: jest.fn().mockReturnValue({ page: 1, skip: 0, take: 10 }),
  createPaginationMeta: jest.fn().mockReturnValue({
    page: 1, limit: 10, total: 1, totalPages: 1,
    hasNextPage: false, hasPreviousPage: false,
  }),
}));
jest.mock('@package/redis', () => ({ RedisService: jest.fn() }));

import { PublicBannerService } from '../../../../../src/modules/banner/public/services/banner.service';
import { BannerRepository } from '../../../../../src/modules/banner/repositories/banner.repository';
import { RedisService } from '@package/redis';

describe('PublicBannerService', () => {
  let service: PublicBannerService;
  let bannerRepo: jest.Mocked<Partial<BannerRepository>>;
  let redis: jest.Mocked<Partial<RedisService>>;

  const mockBanners = [
    { id: 1, title: 'Banner 1', status: 'active' },
    { id: 2, title: 'Banner 2', status: 'active' },
  ];

  beforeEach(() => {
    bannerRepo = {
      findManyPublic: jest.fn().mockResolvedValue(mockBanners),
      count: jest.fn().mockResolvedValue(2),
    };

    redis = {
      isEnabled: jest.fn().mockReturnValue(true),
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
    };

    service = new PublicBannerService(bannerRepo as any, redis as any);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getList', () => {
    it('should return paginated public banners with active status', async () => {
      const result = await service.getList({});

      expect(bannerRepo.findManyPublic).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'active' }),
        expect.any(Object),
      );
      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('meta');
    });

    it('should apply locationId filter', async () => {
      await service.getList({ locationId: '10' });

      expect(bannerRepo.findManyPublic).toHaveBeenCalledWith(
        expect.objectContaining({ locationId: '10', status: 'active' }),
        expect.any(Object),
      );
    });

    it('should apply locationCode filter', async () => {
      await service.getList({ locationCode: 'HERO' });

      expect(bannerRepo.findManyPublic).toHaveBeenCalledWith(
        expect.objectContaining({ locationCode: 'HERO', status: 'active' }),
        expect.any(Object),
      );
    });

    it('should return cached data when available in Redis', async () => {
      const cachedData = { data: mockBanners, meta: { page: 1 } };
      redis.get!.mockResolvedValue(JSON.stringify(cachedData));

      const result = await service.getList({});

      expect(result).toEqual(cachedData);
      expect(bannerRepo.findManyPublic).not.toHaveBeenCalled();
    });

    it('should store result in Redis cache when not cached', async () => {
      redis.get!.mockResolvedValue(null);

      await service.getList({});

      expect(redis.set).toHaveBeenCalledWith(
        'marketing:public:banners:list',
        expect.any(String),
        300,
      );
    });

    it('should work without Redis (redis undefined)', async () => {
      const serviceNoRedis = new PublicBannerService(bannerRepo as any, undefined);

      const result = await serviceNoRedis.getList({});

      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('meta');
    });

    it('should work when Redis is disabled', async () => {
      redis.isEnabled!.mockReturnValue(false);

      const result = await service.getList({});

      expect(redis.get).not.toHaveBeenCalled();
      expect(result).toHaveProperty('data');
    });

    it('should deduplicate concurrent in-flight requests', async () => {
      redis.isEnabled!.mockReturnValue(false);
      let resolveLoader!: (value: any) => void;
      bannerRepo.findManyPublic!.mockImplementation(
        () => new Promise((resolve) => { resolveLoader = resolve; }),
      );

      const promise1 = service.getList({});
      const promise2 = service.getList({});

      resolveLoader(mockBanners);

      const [result1, result2] = await Promise.all([promise1, promise2]);

      // Both calls should resolve to the same result, with only one repo call
      expect(bannerRepo.findManyPublic).toHaveBeenCalledTimes(1);
      expect(result1).toEqual(result2);
    });
  });
});
