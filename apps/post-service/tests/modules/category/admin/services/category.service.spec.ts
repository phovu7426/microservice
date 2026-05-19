// ---------------------------------------------------------------------------
// Module mocks
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

jest.mock('../../../../../src/modules/category/repositories/category.repository', () => ({
  CategoryRepository: jest.fn(),
}));

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AdminCategoryService } from '../../../../../src/modules/category/admin/services/category.service';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeMockCategoryRepo() {
  return {
    findMany: jest.fn().mockResolvedValue([]),
    count: jest.fn().mockResolvedValue(0),
    findById: jest.fn().mockResolvedValue(null),
    findBySlug: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockResolvedValue({ id: 1n, name: 'Cat', slug: 'cat' }),
    update: jest.fn().mockResolvedValue({ id: 1n, name: 'Cat Updated' }),
    delete: jest.fn().mockResolvedValue(undefined),
    getParentId: jest.fn().mockResolvedValue(null),
  };
}

function makeMockI18n() {
  return {} as any;
}

function makeMockRedis() {
  return {
    del: jest.fn().mockResolvedValue(undefined),
    isEnabled: jest.fn().mockReturnValue(true),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('AdminCategoryService', () => {
  let service: AdminCategoryService;
  let categoryRepo: ReturnType<typeof makeMockCategoryRepo>;
  let redis: ReturnType<typeof makeMockRedis>;

  beforeEach(() => {
    categoryRepo = makeMockCategoryRepo();
    redis = makeMockRedis();
    service = new AdminCategoryService(categoryRepo as any, makeMockI18n(), redis as any);
  });

  // ---- getList ----
  describe('getList', () => {
    it('should return paginated categories', async () => {
      categoryRepo.findMany.mockResolvedValue([{ id: 1n, name: 'Cat' }]);
      categoryRepo.count.mockResolvedValue(1);

      const result = await service.getList({});

      expect(result.data).toHaveLength(1);
      expect(result.meta).toEqual({ total: 1 });
    });

    it('should skip count when skipCount is true', async () => {
      categoryRepo.findMany.mockResolvedValue([]);
      const result = await service.getList({ skipCount: true });
      expect(categoryRepo.count).not.toHaveBeenCalled();
      expect(result.meta).toEqual({ total: 0 });
    });

    it('should apply search and isActive filters', async () => {
      categoryRepo.findMany.mockResolvedValue([]);
      await service.getList({ search: 'tech', isActive: 'true' });
      expect(categoryRepo.findMany).toHaveBeenCalled();
    });

    it('should handle parentId=null filter', async () => {
      categoryRepo.findMany.mockResolvedValue([]);
      await service.getList({ parentId: 'null' });
      expect(categoryRepo.findMany).toHaveBeenCalled();
    });
  });

  // ---- getOne ----
  describe('getOne', () => {
    it('should return category when found', async () => {
      categoryRepo.findById.mockResolvedValue({ id: 1n, name: 'Cat' });
      const result = await service.getOne(1n);
      expect(result).toEqual({ id: 1n, name: 'Cat' });
    });

    it('should throw NotFoundException when not found', async () => {
      categoryRepo.findById.mockResolvedValue(null);
      await expect(service.getOne(999n)).rejects.toThrow(NotFoundException);
    });
  });

  // ---- create ----
  describe('create', () => {
    it('should create category with slug and invalidate cache', async () => {
      const result = await service.create({ name: 'Tech' } as any, 1n);

      expect(categoryRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Tech', slug: 'generated-slug', createdUserId: 1n }),
      );
      expect(redis.del).toHaveBeenCalledWith('post:public:categories:list');
      expect(result).toHaveProperty('id');
    });

    it('should validate parent exists when parentId is set', async () => {
      categoryRepo.findById.mockResolvedValue(null);
      await expect(
        service.create({ name: 'Sub', parentId: '999' } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('should allow create with valid parent', async () => {
      categoryRepo.findById.mockResolvedValue({ id: 1n, name: 'Parent' });
      const result = await service.create({ name: 'Sub', parentId: '1' } as any);
      expect(result).toHaveProperty('id');
    });
  });

  // ---- update ----
  describe('update', () => {
    it('should update category and regenerate slug on name change', async () => {
      categoryRepo.findById.mockResolvedValue({ id: 1n, name: 'Old' });
      const result = await service.update(1n, { name: 'New' } as any, 2n);

      expect(categoryRepo.update).toHaveBeenCalledWith(
        1n,
        expect.objectContaining({ name: 'New', slug: 'generated-slug', updatedUserId: 2n }),
      );
      expect(redis.del).toHaveBeenCalledWith('post:public:categories:list');
      expect(result).toBeDefined();
    });

    it('should throw NotFoundException when category not found', async () => {
      categoryRepo.findById.mockResolvedValue(null);
      await expect(service.update(999n, { name: 'x' } as any)).rejects.toThrow(NotFoundException);
    });

    it('should NOT regenerate slug when name is the same as current', async () => {
      const { SlugHelper } = require('@package/common');
      categoryRepo.findById.mockResolvedValue({ id: 1n, name: 'Same Name', slug: 'same-name' });
      (SlugHelper.uniqueSlug as jest.Mock).mockClear();

      await service.update(1n, { name: 'Same Name', description: 'updated desc' } as any);

      expect(SlugHelper.uniqueSlug).not.toHaveBeenCalled();
    });

    it('should detect cycle when setting parentId to self', async () => {
      categoryRepo.findById.mockResolvedValue({ id: 1n, name: 'Cat' });
      await expect(
        service.update(1n, { parentId: '1' } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('should detect indirect cycle in parent chain', async () => {
      categoryRepo.findById.mockResolvedValue({ id: 1n, name: 'Cat' });
      categoryRepo.getParentId.mockResolvedValueOnce(1n);

      await expect(
        service.update(1n, { parentId: '2' } as any),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ---- delete ----
  describe('delete', () => {
    it('should delete and invalidate cache', async () => {
      categoryRepo.findById.mockResolvedValue({ id: 1n });
      const result = await service.delete(1n);

      expect(categoryRepo.delete).toHaveBeenCalledWith(1n);
      expect(redis.del).toHaveBeenCalledWith('post:public:categories:list');
      expect(result).toEqual({ success: true });
    });

    it('should throw NotFoundException when category not found', async () => {
      categoryRepo.findById.mockResolvedValue(null);
      await expect(service.delete(999n)).rejects.toThrow(NotFoundException);
    });
  });
});
