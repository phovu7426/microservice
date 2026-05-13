jest.mock('@package/common', () => ({
  createPaginationMeta: jest.fn().mockReturnValue({ page: 1, limit: 10, total: 0 }),
  parseQueryOptions: jest.fn().mockReturnValue({ page: 1, limit: 10 }),
}));
jest.mock('@package/redis', () => ({ RedisService: jest.fn() }));
jest.mock('src/types', () => ({ PrimaryKey: BigInt }), { virtual: true });
jest.mock('src/generated/prisma', () => ({ Prisma: {}, PrismaClient: class {} }), { virtual: true });
jest.mock('../../../../../src/modules/faq/repositories/faq.repository', () => ({
  FaqRepository: jest.fn(),
}));

import { NotFoundException } from '@nestjs/common';
import { PublicFaqService } from '../../../../../src/modules/faq/public/services/faq.service';

describe('PublicFaqService', () => {
  let service: PublicFaqService;
  let faqRepo: Record<string, jest.Mock>;
  let redis: Record<string, jest.Mock>;

  const mockItem = { id: 1, question: 'What?', answer: 'This.', status: 'active', viewCount: 5, helpfulCount: 3 };

  beforeEach(() => {
    faqRepo = {
      findMany: jest.fn().mockResolvedValue([mockItem]),
      count: jest.fn().mockResolvedValue(1),
      findActiveById: jest.fn().mockResolvedValue(mockItem),
      update: jest.fn().mockResolvedValue(mockItem),
    };

    redis = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
      del: jest.fn().mockResolvedValue(undefined),
    };

    service = new PublicFaqService(faqRepo as any, redis as any);
  });

  afterEach(() => jest.clearAllMocks());

  describe('getList', () => {
    it('should return paginated list with active filter', async () => {
      const result = await service.getList({});
      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('meta');
      expect(faqRepo.findMany).toHaveBeenCalled();
    });

    it('should return cached data when available', async () => {
      const cached = JSON.stringify({ data: [mockItem], meta: { page: 1 } });
      redis.get.mockResolvedValue(cached);

      const result = await service.getList({});
      expect(result).toEqual(JSON.parse(cached));
      expect(faqRepo.findMany).not.toHaveBeenCalled();
    });
  });

  describe('getOne', () => {
    it('should return item when found', async () => {
      const result = await service.getOne(1n);
      expect(result).toEqual(mockItem);
      expect(faqRepo.findActiveById).toHaveBeenCalledWith(1n);
    });

    it('should throw NotFoundException when not found', async () => {
      faqRepo.findActiveById.mockResolvedValue(null);
      await expect(service.getOne(1n)).rejects.toThrow(NotFoundException);
    });

    it('should return cached data when available', async () => {
      redis.get.mockResolvedValue(JSON.stringify(mockItem));
      const result = await service.getOne(1n);
      expect(result).toEqual(mockItem);
      expect(faqRepo.findActiveById).not.toHaveBeenCalled();
    });
  });

  describe('incrementViewCount', () => {
    it('should increment view count and return new count', async () => {
      const result = await service.incrementViewCount(1n);
      expect(result).toEqual({ success: true, view_count: 6 });
      expect(faqRepo.update).toHaveBeenCalledWith(1n, { viewCount: { increment: 1 } });
    });

    it('should throw NotFoundException when item not found', async () => {
      faqRepo.findActiveById.mockResolvedValue(null);
      await expect(service.incrementViewCount(1n)).rejects.toThrow(NotFoundException);
    });
  });

  describe('incrementHelpfulCount', () => {
    it('should increment helpful count and return new count', async () => {
      const result = await service.incrementHelpfulCount(1n);
      expect(result).toEqual({ success: true, helpful_count: 4 });
      expect(faqRepo.update).toHaveBeenCalledWith(1n, { helpfulCount: { increment: 1 } });
    });

    it('should throw NotFoundException when item not found', async () => {
      faqRepo.findActiveById.mockResolvedValue(null);
      await expect(service.incrementHelpfulCount(1n)).rejects.toThrow(NotFoundException);
    });
  });
});
