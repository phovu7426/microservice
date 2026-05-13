jest.mock('@package/common', () => ({
  createPaginationMeta: jest.fn().mockReturnValue({ page: 1, limit: 10, total: 0 }),
  parseQueryOptions: jest.fn().mockReturnValue({ page: 1, limit: 10 }),
}));
jest.mock('@package/redis', () => ({ RedisService: jest.fn() }));
jest.mock('src/types', () => ({ PrimaryKey: BigInt }), { virtual: true });
jest.mock('src/generated/prisma', () => ({ Prisma: {}, PrismaClient: class {} }), { virtual: true });
jest.mock('../../../../../src/modules/testimonial/repositories/testimonial.repository', () => ({
  TestimonialRepository: jest.fn(),
}));

import { NotFoundException } from '@nestjs/common';
import { PublicTestimonialService } from '../../../../../src/modules/testimonial/public/services/testimonial.service';

describe('PublicTestimonialService', () => {
  let service: PublicTestimonialService;
  let testimonialRepo: Record<string, jest.Mock>;
  let redis: Record<string, jest.Mock>;

  const mockItem = { id: 1, clientName: 'Client A', content: 'Great!', status: 'active' };

  beforeEach(() => {
    testimonialRepo = {
      findMany: jest.fn().mockResolvedValue([mockItem]),
      count: jest.fn().mockResolvedValue(1),
      findActiveById: jest.fn().mockResolvedValue(mockItem),
    };

    redis = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
      del: jest.fn().mockResolvedValue(undefined),
    };

    service = new PublicTestimonialService(testimonialRepo as any, redis as any);
  });

  afterEach(() => jest.clearAllMocks());

  describe('getList', () => {
    it('should return paginated list with active filter', async () => {
      const result = await service.getList({});
      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('meta');
      expect(testimonialRepo.findMany).toHaveBeenCalled();
    });

    it('should return cached data when available', async () => {
      const cached = JSON.stringify({ data: [mockItem], meta: { page: 1 } });
      redis.get.mockResolvedValue(cached);

      const result = await service.getList({});
      expect(result).toEqual(JSON.parse(cached));
      expect(testimonialRepo.findMany).not.toHaveBeenCalled();
    });
  });

  describe('getOne', () => {
    it('should return item when found', async () => {
      const result = await service.getOne(1n);
      expect(result).toEqual(mockItem);
      expect(testimonialRepo.findActiveById).toHaveBeenCalledWith(1n);
    });

    it('should throw NotFoundException when not found', async () => {
      testimonialRepo.findActiveById.mockResolvedValue(null);
      await expect(service.getOne(1n)).rejects.toThrow(NotFoundException);
    });

    it('should return cached data when available', async () => {
      redis.get.mockResolvedValue(JSON.stringify(mockItem));
      const result = await service.getOne(1n);
      expect(result).toEqual(mockItem);
      expect(testimonialRepo.findActiveById).not.toHaveBeenCalled();
    });
  });
});
