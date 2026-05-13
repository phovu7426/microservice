jest.mock('@package/common', () => ({
  createPaginationMeta: jest.fn().mockReturnValue({ page: 1, limit: 10, total: 0 }),
  parseQueryOptions: jest.fn().mockReturnValue({ page: 1, limit: 10 }),
}));
jest.mock('@package/redis', () => ({ RedisService: jest.fn() }));
jest.mock('src/types', () => ({ PrimaryKey: BigInt }), { virtual: true });
jest.mock('src/generated/prisma', () => ({ Prisma: {}, PrismaClient: class {} }), { virtual: true });
jest.mock('../../../../../src/modules/certificate/repositories/certificate.repository', () => ({
  CertificateRepository: jest.fn(),
}));

import { NotFoundException } from '@nestjs/common';
import { AdminCertificateService } from '../../../../../src/modules/certificate/admin/services/certificate.service';

describe('AdminCertificateService', () => {
  let service: AdminCertificateService;
  let certificateRepo: Record<string, jest.Mock>;
  let redis: Record<string, jest.Mock>;

  const mockItem = { id: 1n, name: 'ISO 9001', status: 'active', sortOrder: 0 };

  beforeEach(() => {
    certificateRepo = {
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

    service = new AdminCertificateService(certificateRepo as any, redis as any);
  });

  afterEach(() => jest.clearAllMocks());

  describe('getList', () => {
    it('should return paginated list', async () => {
      const result = await service.getList({});
      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('meta');
      expect(certificateRepo.findMany).toHaveBeenCalled();
      expect(certificateRepo.count).toHaveBeenCalled();
    });

    it('should skip count when skipCount is true', async () => {
      await service.getList({ skipCount: true });
      expect(certificateRepo.count).not.toHaveBeenCalled();
    });

    it('should skip count when skipCount is string "true"', async () => {
      await service.getList({ skipCount: 'true' });
      expect(certificateRepo.count).not.toHaveBeenCalled();
    });

    it('should pass search, status, and type filters', async () => {
      await service.getList({ search: 'iso', status: 'active', type: 'quality' });
      expect(certificateRepo.findMany).toHaveBeenCalled();
    });
  });

  describe('getOne', () => {
    it('should return item when found', async () => {
      const result = await service.getOne(1n);
      expect(result).toEqual(mockItem);
      expect(certificateRepo.findById).toHaveBeenCalledWith(1n);
    });

    it('should throw NotFoundException when not found', async () => {
      certificateRepo.findById.mockResolvedValue(null);
      await expect(service.getOne(1n)).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('should create with defaults and clear cache', async () => {
      const dto = { name: 'ISO 9001' };
      const result = await service.create(dto as any);
      expect(result).toEqual(mockItem);
      expect(certificateRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'ISO 9001', status: 'active', sortOrder: 0 }),
      );
      expect(redis.del).toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('should update and clear cache', async () => {
      const result = await service.update(1n, { name: 'Updated' } as any);
      expect(result).toEqual(mockItem);
      expect(certificateRepo.update).toHaveBeenCalledWith(1n, expect.objectContaining({ name: 'Updated' }));
      expect(redis.del).toHaveBeenCalled();
    });

    it('should throw NotFoundException when item not found', async () => {
      certificateRepo.findById.mockResolvedValue(null);
      await expect(service.update(1n, { name: 'X' } as any)).rejects.toThrow(NotFoundException);
    });
  });

  describe('delete', () => {
    it('should delete and clear cache', async () => {
      const result = await service.delete(1n);
      expect(result).toEqual({ success: true });
      expect(certificateRepo.delete).toHaveBeenCalledWith(1n);
      expect(redis.del).toHaveBeenCalled();
    });

    it('should throw NotFoundException when item not found', async () => {
      certificateRepo.findById.mockResolvedValue(null);
      await expect(service.delete(1n)).rejects.toThrow(NotFoundException);
    });
  });
});
