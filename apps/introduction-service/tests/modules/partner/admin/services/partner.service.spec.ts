jest.mock('@package/common', () => ({
  createPaginationMeta: jest.fn().mockReturnValue({ page: 1, limit: 10, total: 0 }),
  parseQueryOptions: jest.fn().mockReturnValue({ page: 1, limit: 10 }),
}));
jest.mock('@package/redis', () => ({ RedisService: jest.fn() }));
jest.mock('src/types', () => ({ PrimaryKey: BigInt }), { virtual: true });
jest.mock('src/generated/prisma', () => ({ Prisma: {}, PrismaClient: class {} }), { virtual: true });
jest.mock('../../../../../src/modules/partner/repositories/partner.repository', () => ({
  PartnerRepository: jest.fn(),
}));

import { NotFoundException } from '@nestjs/common';
import { AdminPartnerService } from '../../../../../src/modules/partner/admin/services/partner.service';

describe('AdminPartnerService', () => {
  let service: AdminPartnerService;
  let partnerRepo: Record<string, jest.Mock>;
  let redis: Record<string, jest.Mock>;

  const mockItem = { id: 1n, name: 'Partner A', status: 'active', sortOrder: 0 };

  beforeEach(() => {
    partnerRepo = {
      findMany: jest.fn().mockResolvedValue([mockItem]),
      count: jest.fn().mockResolvedValue(1),
      findById: jest.fn().mockResolvedValue(mockItem),
      create: jest.fn().mockResolvedValue(mockItem),
      update: jest.fn().mockResolvedValue(mockItem),
      delete: jest.fn().mockResolvedValue(undefined),
    };

    redis = {
      del: jest.fn().mockResolvedValue(undefined),
    };

    service = new AdminPartnerService(partnerRepo as any, redis as any);
  });

  afterEach(() => jest.clearAllMocks());

  describe('getList', () => {
    it('should return paginated list', async () => {
      const result = await service.getList({});
      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('meta');
      expect(partnerRepo.findMany).toHaveBeenCalled();
      expect(partnerRepo.count).toHaveBeenCalled();
    });

    it('should skip count when skipCount is true', async () => {
      await service.getList({ skipCount: true });
      expect(partnerRepo.count).not.toHaveBeenCalled();
    });

    it('should skip count when skipCount is string "true"', async () => {
      await service.getList({ skipCount: 'true' });
      expect(partnerRepo.count).not.toHaveBeenCalled();
    });

    it('should pass search, status, and type filters', async () => {
      await service.getList({ search: 'test', status: 'active', type: 'sponsor' });
      expect(partnerRepo.findMany).toHaveBeenCalled();
    });
  });

  describe('getOne', () => {
    it('should return item when found', async () => {
      const result = await service.getOne(1n);
      expect(result).toEqual(mockItem);
      expect(partnerRepo.findById).toHaveBeenCalledWith(1n);
    });

    it('should throw NotFoundException when not found', async () => {
      partnerRepo.findById.mockResolvedValue(null);
      await expect(service.getOne(1n)).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('should create with defaults and clear cache', async () => {
      const dto = { name: 'Partner A' };
      const result = await service.create(dto as any);
      expect(result).toEqual(mockItem);
      expect(partnerRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Partner A', status: 'active', sortOrder: 0 }),
      );
      expect(redis.del).toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('should update and clear cache', async () => {
      const result = await service.update(1n, { name: 'Updated' } as any);
      expect(result).toEqual(mockItem);
      expect(partnerRepo.update).toHaveBeenCalledWith(1n, expect.objectContaining({ name: 'Updated' }));
      expect(redis.del).toHaveBeenCalled();
    });

    it('should throw NotFoundException when item not found', async () => {
      partnerRepo.findById.mockResolvedValue(null);
      await expect(service.update(1n, { name: 'X' } as any)).rejects.toThrow(NotFoundException);
    });
  });

  describe('delete', () => {
    it('should delete and clear cache', async () => {
      const result = await service.delete(1n);
      expect(result).toEqual({ success: true });
      expect(partnerRepo.delete).toHaveBeenCalledWith(1n);
      expect(redis.del).toHaveBeenCalled();
    });

    it('should throw NotFoundException when item not found', async () => {
      partnerRepo.findById.mockResolvedValue(null);
      await expect(service.delete(1n)).rejects.toThrow(NotFoundException);
    });
  });
});
