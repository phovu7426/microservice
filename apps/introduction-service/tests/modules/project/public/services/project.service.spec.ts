jest.mock('@package/common', () => ({
  createPaginationMeta: jest.fn().mockReturnValue({ page: 1, limit: 10, total: 0 }),
  parseQueryOptions: jest.fn().mockReturnValue({ page: 1, limit: 10 }),
}));
jest.mock('@package/redis', () => ({ RedisService: jest.fn() }));
jest.mock('src/types', () => ({ PrimaryKey: BigInt }), { virtual: true });
jest.mock('src/generated/prisma', () => ({ Prisma: {}, PrismaClient: class {} }), { virtual: true });
jest.mock('../../../../../src/modules/project/repositories/project.repository', () => ({
  ProjectRepository: jest.fn(),
}));

import { NotFoundException } from '@nestjs/common';
import { PublicProjectService } from '../../../../../src/modules/project/public/services/project.service';

describe('PublicProjectService', () => {
  let service: PublicProjectService;
  let projectRepo: Record<string, jest.Mock>;
  let redis: Record<string, jest.Mock>;

  const mockItem = { id: 1, name: 'Project 1', slug: 'project-1', status: 'in_progress', viewCount: 10 };

  beforeEach(() => {
    projectRepo = {
      findManyPublic: jest.fn().mockResolvedValue([mockItem]),
      count: jest.fn().mockResolvedValue(1),
      findPublicBySlug: jest.fn().mockResolvedValue(mockItem),
      incrementViewCount: jest.fn().mockResolvedValue(undefined),
    };

    redis = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
      del: jest.fn().mockResolvedValue(undefined),
    };

    service = new PublicProjectService(projectRepo as any, redis as any);
  });

  afterEach(() => jest.clearAllMocks());

  describe('getList', () => {
    it('should return paginated list with public status filter', async () => {
      const result = await service.getList({});
      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('meta');
      expect(projectRepo.findManyPublic).toHaveBeenCalled();
    });

    it('should return cached data when available', async () => {
      const cached = JSON.stringify({ data: [mockItem], meta: { page: 1 } });
      redis.get.mockResolvedValue(cached);

      const result = await service.getList({});
      expect(result).toEqual(JSON.parse(cached));
      expect(projectRepo.findManyPublic).not.toHaveBeenCalled();
    });
  });

  describe('getBySlug', () => {
    it('should return item with incremented view count when found', async () => {
      const result = await service.getBySlug('project-1');
      expect(result).toEqual({ ...mockItem, viewCount: 11 });
      expect(projectRepo.findPublicBySlug).toHaveBeenCalledWith(
        'project-1',
        ['planning', 'in_progress', 'completed'],
      );
      expect(projectRepo.incrementViewCount).toHaveBeenCalledWith(1);
    });

    it('should throw NotFoundException when not found', async () => {
      projectRepo.findPublicBySlug.mockResolvedValue(null);
      await expect(service.getBySlug('nonexistent')).rejects.toThrow(NotFoundException);
    });

    it('should return cached data when available', async () => {
      redis.get.mockResolvedValue(JSON.stringify(mockItem));
      const result = await service.getBySlug('project-1');
      expect(result).toEqual(mockItem);
      expect(projectRepo.findPublicBySlug).not.toHaveBeenCalled();
    });
  });
});
