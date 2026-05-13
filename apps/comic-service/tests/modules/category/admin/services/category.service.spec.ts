// ---------------------------------------------------------------------------
// Module mocks — must come before any import that transitively loads them.
// ---------------------------------------------------------------------------
jest.mock('@package/common', () => ({
  t: (_i18n: any, key: string) => key,
  createPaginationMeta: jest.fn((_opts: any, total: number) => ({ total })),
  parseQueryOptions: jest.fn((q: any) => ({ skip: 0, take: q?.take ?? 20 })),
  SlugHelper: {
    uniqueSlug: jest.fn(async (name: string) => `${name}-slug`),
  },
}));

jest.mock('@package/bootstrap', () => ({ FileLogger: jest.fn() }));

jest.mock('nestjs-i18n', () => ({
  I18nContext: { current: () => ({ lang: 'en' }) },
  I18nService: jest.fn(),
}));

jest.mock('src/types', () => ({
  toPrimaryKey: (v: string) => BigInt(v),
}), { virtual: true });

jest.mock('src/generated/prisma', () => ({ Prisma: {}, PrismaClient: class {} }), { virtual: true });
jest.mock('@prisma/adapter-pg', () => ({ PrismaPg: jest.fn() }));
jest.mock('../../../../../src/modules/category/repositories/category.repository', () => ({
  CategoryRepository: jest.fn(),
}));

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------
import { NotFoundException } from '@nestjs/common';
import { AdminCategoryService } from '../../../../../src/modules/category/admin/services/category.service';
import { SlugHelper } from '@package/common';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeMockCategoryRepo() {
  return {
    findMany: jest.fn().mockResolvedValue([]),
    count: jest.fn().mockResolvedValue(0),
    findById: jest.fn(),
    findBySlug: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };
}

function makeMockRedis() {
  return {
    del: jest.fn().mockResolvedValue(1),
    isEnabled: jest.fn().mockReturnValue(true),
  };
}

function makeMockI18n() {
  return { t: jest.fn((key: string) => key) };
}

function buildService() {
  const categoryRepo = makeMockCategoryRepo();
  const i18n = makeMockI18n();
  const redis = makeMockRedis();

  const service = new AdminCategoryService(
    categoryRepo as any,
    i18n as any,
    redis as any,
  );

  return { service, categoryRepo, i18n, redis };
}

const sampleCategory = { id: 1n, name: 'Action', slug: 'action' };

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('AdminCategoryService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // -----------------------------------------------------------------------
  // getList()
  // -----------------------------------------------------------------------
  describe('getList()', () => {
    it('returns paginated list', async () => {
      const { service, categoryRepo } = buildService();
      categoryRepo.findMany.mockResolvedValue([sampleCategory]);
      categoryRepo.count.mockResolvedValue(1);

      const result = await service.getList({});

      expect(result.data).toHaveLength(1);
      expect(result.meta).toEqual({ total: 1 });
    });

    it('skips count when skipCount is true', async () => {
      const { service, categoryRepo } = buildService();
      categoryRepo.findMany.mockResolvedValue([]);

      await service.getList({ skipCount: true });

      expect(categoryRepo.count).not.toHaveBeenCalled();
    });

    it('builds search filter from query', async () => {
      const { service, categoryRepo } = buildService();
      categoryRepo.findMany.mockResolvedValue([]);

      await service.getList({ search: 'action' });

      expect(categoryRepo.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ search: 'action' }),
        expect.anything(),
      );
    });
  });

  // -----------------------------------------------------------------------
  // getOne()
  // -----------------------------------------------------------------------
  describe('getOne()', () => {
    it('returns category by id', async () => {
      const { service, categoryRepo } = buildService();
      categoryRepo.findById.mockResolvedValue(sampleCategory);

      const result = await service.getOne(1n);

      expect(result).toEqual(sampleCategory);
    });

    it('throws NotFoundException when not found', async () => {
      const { service, categoryRepo } = buildService();
      categoryRepo.findById.mockResolvedValue(null);

      await expect(service.getOne(999n)).rejects.toThrow(NotFoundException);
    });
  });

  // -----------------------------------------------------------------------
  // create()
  // -----------------------------------------------------------------------
  describe('create()', () => {
    it('creates category with generated slug and clears cache', async () => {
      const { service, categoryRepo, redis } = buildService();
      const created = { id: 2n, name: 'Comedy', slug: 'Comedy-slug' };
      categoryRepo.create.mockResolvedValue(created);

      const result = await service.create({ name: 'Comedy' } as any, 1n);

      expect(SlugHelper.uniqueSlug).toHaveBeenCalledWith('Comedy', expect.anything());
      expect(categoryRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Comedy', slug: 'Comedy-slug', createdUserId: 1n }),
      );
      expect(redis.del).toHaveBeenCalledWith('comic:public:categories');
      expect(result).toEqual(created);
    });
  });

  // -----------------------------------------------------------------------
  // update()
  // -----------------------------------------------------------------------
  describe('update()', () => {
    it('updates category and regenerates slug when name changes', async () => {
      const { service, categoryRepo, redis } = buildService();
      categoryRepo.findById.mockResolvedValue(sampleCategory);
      categoryRepo.update.mockResolvedValue({ ...sampleCategory, name: 'Drama', slug: 'Drama-slug' });

      await service.update(1n, { name: 'Drama' } as any, 1n);

      expect(SlugHelper.uniqueSlug).toHaveBeenCalledWith('Drama', expect.anything(), 1n);
      expect(categoryRepo.update).toHaveBeenCalledWith(1n, expect.objectContaining({ name: 'Drama', slug: 'Drama-slug', updatedUserId: 1n }));
      expect(redis.del).toHaveBeenCalledWith('comic:public:categories');
    });

    it('does not regenerate slug when name not provided', async () => {
      const { service, categoryRepo } = buildService();
      categoryRepo.findById.mockResolvedValue(sampleCategory);
      categoryRepo.update.mockResolvedValue(sampleCategory);

      await service.update(1n, { description: 'Updated desc' } as any);

      expect(SlugHelper.uniqueSlug).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when category not found', async () => {
      const { service, categoryRepo } = buildService();
      categoryRepo.findById.mockResolvedValue(null);

      await expect(service.update(999n, { name: 'X' } as any)).rejects.toThrow(NotFoundException);
    });
  });

  // -----------------------------------------------------------------------
  // delete()
  // -----------------------------------------------------------------------
  describe('delete()', () => {
    it('deletes category and clears cache', async () => {
      const { service, categoryRepo, redis } = buildService();
      categoryRepo.findById.mockResolvedValue(sampleCategory);

      const result = await service.delete(1n);

      expect(result).toEqual({ success: true });
      expect(categoryRepo.delete).toHaveBeenCalledWith(1n);
      expect(redis.del).toHaveBeenCalledWith('comic:public:categories');
    });

    it('throws NotFoundException when deleting non-existent category', async () => {
      const { service, categoryRepo } = buildService();
      categoryRepo.findById.mockResolvedValue(null);

      await expect(service.delete(999n)).rejects.toThrow(NotFoundException);
    });
  });
});
