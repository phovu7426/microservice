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

import { NotFoundException } from '@nestjs/common';
import { AdminBannerService } from '../../../../../src/modules/banner/admin/services/banner.service';
import { BannerRepository } from '../../../../../src/modules/banner/repositories/banner.repository';
import { BannerLocationRepository } from '../../../../../src/modules/banner-location/repositories/banner-location.repository';
import { RedisService } from '@package/redis';

describe('AdminBannerService', () => {
  let service: AdminBannerService;
  let bannerRepo: jest.Mocked<Partial<BannerRepository>>;
  let locationRepo: jest.Mocked<Partial<BannerLocationRepository>>;
  let redis: jest.Mocked<Partial<RedisService>>;

  const mockBanner = {
    id: 1n,
    title: 'Test Banner',
    subtitle: 'Subtitle',
    image: 'image.jpg',
    mobileImage: 'mobile.jpg',
    link: 'https://example.com',
    linkTarget: '_blank',
    description: 'desc',
    buttonText: 'Click',
    buttonColor: '#fff',
    textColor: '#000',
    locationId: 10n,
    sortOrder: 0,
    status: 'active',
    startDate: null,
    endDate: null,
  };

  const mockLocation = {
    id: 10n,
    code: 'HERO',
    name: 'Hero Section',
    status: 'active',
  };

  beforeEach(() => {
    bannerRepo = {
      findMany: jest.fn(),
      count: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };

    locationRepo = {
      findById: jest.fn(),
    };

    redis = {
      del: jest.fn().mockResolvedValue(undefined),
    };

    service = new AdminBannerService(
      bannerRepo as any,
      locationRepo as any,
      redis as any,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getList', () => {
    it('should return paginated banner list', async () => {
      bannerRepo.findMany!.mockResolvedValue([mockBanner] as any);
      bannerRepo.count!.mockResolvedValue(1);

      const result = await service.getList({ page: 1, limit: 10 });

      expect(bannerRepo.findMany).toHaveBeenCalled();
      expect(bannerRepo.count).toHaveBeenCalled();
      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('meta');
    });

    it('should apply search filter', async () => {
      bannerRepo.findMany!.mockResolvedValue([]);
      bannerRepo.count!.mockResolvedValue(0);

      await service.getList({ search: 'test' });

      expect(bannerRepo.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ search: 'test' }),
        expect.any(Object),
      );
    });

    it('should apply status and locationId filters', async () => {
      bannerRepo.findMany!.mockResolvedValue([]);
      bannerRepo.count!.mockResolvedValue(0);

      await service.getList({ status: 'active', locationId: '10' });

      expect(bannerRepo.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'active', locationId: '10' }),
        expect.any(Object),
      );
    });

    it('should skip count when skipCount is true', async () => {
      bannerRepo.findMany!.mockResolvedValue([]);

      await service.getList({ skipCount: true });

      expect(bannerRepo.count).not.toHaveBeenCalled();
    });

    it('should skip count when skipCount is string "true"', async () => {
      bannerRepo.findMany!.mockResolvedValue([]);

      await service.getList({ skipCount: 'true' });

      expect(bannerRepo.count).not.toHaveBeenCalled();
    });
  });

  describe('getOne', () => {
    it('should return banner by id', async () => {
      bannerRepo.findById!.mockResolvedValue(mockBanner as any);

      const result = await service.getOne(1n);

      expect(bannerRepo.findById).toHaveBeenCalledWith(1n);
      expect(result).toEqual(mockBanner);
    });

    it('should throw NotFoundException when banner not found', async () => {
      bannerRepo.findById!.mockResolvedValue(null);

      await expect(service.getOne(1n)).rejects.toThrow(NotFoundException);
      await expect(service.getOne(1n)).rejects.toThrow('Banner not found');
    });
  });

  describe('create', () => {
    const createDto = {
      title: 'New Banner',
      subtitle: 'Sub',
      image: 'img.jpg',
      mobileImage: 'mob.jpg',
      link: 'https://example.com',
      linkTarget: '_blank',
      description: 'desc',
      buttonText: 'Click',
      buttonColor: '#fff',
      textColor: '#000',
      locationId: 10n,
      sortOrder: 1,
      status: 'active',
      startDate: null,
      endDate: null,
    };

    it('should validate location, create banner, clear cache, and return banner', async () => {
      locationRepo.findById!.mockResolvedValue(mockLocation as any);
      bannerRepo.create!.mockResolvedValue({ ...mockBanner, id: 2n } as any);
      bannerRepo.findById!.mockResolvedValue({ ...mockBanner, id: 2n } as any);

      const result = await service.create(createDto as any);

      expect(locationRepo.findById).toHaveBeenCalledWith(10n);
      expect(bannerRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'New Banner', locationId: 10n }),
      );
      expect(redis.del).toHaveBeenCalledWith('marketing:public:banners:list');
      expect(result).toEqual(expect.objectContaining({ id: 2n }));
    });

    it('should throw NotFoundException when location does not exist', async () => {
      locationRepo.findById!.mockResolvedValue(null);

      await expect(service.create(createDto as any)).rejects.toThrow(NotFoundException);
      await expect(service.create(createDto as any)).rejects.toThrow('Banner location not found');
    });

    it('should default sortOrder to 0 when not provided', async () => {
      locationRepo.findById!.mockResolvedValue(mockLocation as any);
      bannerRepo.create!.mockResolvedValue(mockBanner as any);
      bannerRepo.findById!.mockResolvedValue(mockBanner as any);

      const dtoNoSort = { ...createDto, sortOrder: undefined };
      await service.create(dtoNoSort as any);

      expect(bannerRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ sortOrder: 0 }),
      );
    });

    it('should default status to "active" when not provided', async () => {
      locationRepo.findById!.mockResolvedValue(mockLocation as any);
      bannerRepo.create!.mockResolvedValue(mockBanner as any);
      bannerRepo.findById!.mockResolvedValue(mockBanner as any);

      const dtoNoStatus = { ...createDto, status: undefined };
      await service.create(dtoNoStatus as any);

      expect(bannerRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'active' }),
      );
    });
  });

  describe('update', () => {
    const updateDto = {
      title: 'Updated Banner',
    };

    it('should verify banner exists, update, clear cache, and return updated banner', async () => {
      bannerRepo.findById!.mockResolvedValue(mockBanner as any);
      bannerRepo.update!.mockResolvedValue(undefined as any);

      const result = await service.update(1n, updateDto as any);

      expect(bannerRepo.findById).toHaveBeenCalledWith(1n);
      expect(bannerRepo.update).toHaveBeenCalledWith(1n, expect.objectContaining({ title: 'Updated Banner' }));
      expect(redis.del).toHaveBeenCalledWith('marketing:public:banners:list');
      expect(result).toEqual(mockBanner);
    });

    it('should validate location when locationId is provided', async () => {
      bannerRepo.findById!.mockResolvedValue(mockBanner as any);
      locationRepo.findById!.mockResolvedValue(mockLocation as any);
      bannerRepo.update!.mockResolvedValue(undefined as any);

      await service.update(1n, { locationId: 10n } as any);

      expect(locationRepo.findById).toHaveBeenCalledWith(10n);
    });

    it('should throw NotFoundException when locationId is invalid', async () => {
      bannerRepo.findById!.mockResolvedValue(mockBanner as any);
      locationRepo.findById!.mockResolvedValue(null);

      await expect(
        service.update(1n, { locationId: 999n } as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when banner does not exist', async () => {
      bannerRepo.findById!.mockResolvedValue(null);

      await expect(service.update(1n, updateDto as any)).rejects.toThrow(NotFoundException);
    });
  });

  describe('delete', () => {
    it('should verify banner exists, delete, clear cache, and return success', async () => {
      bannerRepo.findById!.mockResolvedValue(mockBanner as any);
      bannerRepo.delete!.mockResolvedValue(undefined as any);

      const result = await service.delete(1n);

      expect(bannerRepo.findById).toHaveBeenCalledWith(1n);
      expect(bannerRepo.delete).toHaveBeenCalledWith(1n);
      expect(redis.del).toHaveBeenCalledWith('marketing:public:banners:list');
      expect(result).toEqual({ success: true });
    });

    it('should throw NotFoundException when banner does not exist', async () => {
      bannerRepo.findById!.mockResolvedValue(null);

      await expect(service.delete(1n)).rejects.toThrow(NotFoundException);
    });
  });

  describe('clearCache (via create/update/delete)', () => {
    it('should not throw when redis is undefined', async () => {
      const serviceNoRedis = new AdminBannerService(
        bannerRepo as any,
        locationRepo as any,
        undefined,
      );

      bannerRepo.findById!.mockResolvedValue(mockBanner as any);
      bannerRepo.delete!.mockResolvedValue(undefined as any);

      await expect(serviceNoRedis.delete(1n)).resolves.toEqual({ success: true });
    });
  });
});
