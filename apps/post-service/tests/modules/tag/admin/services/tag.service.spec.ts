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

jest.mock('../../../../../src/modules/tag/repositories/tag.repository', () => ({
  TagRepository: jest.fn(),
}));

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------
import { NotFoundException } from '@nestjs/common';
import { AdminTagService } from '../../../../../src/modules/tag/admin/services/tag.service';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeMockTagRepo() {
  return {
    findMany: jest.fn().mockResolvedValue([]),
    count: jest.fn().mockResolvedValue(0),
    findById: jest.fn().mockResolvedValue(null),
    findBySlug: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockResolvedValue({ id: 1n, name: 'Tag', slug: 'tag' }),
    update: jest.fn().mockResolvedValue({ id: 1n, name: 'Tag Updated' }),
    delete: jest.fn().mockResolvedValue(undefined),
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
describe('AdminTagService', () => {
  let service: AdminTagService;
  let tagRepo: ReturnType<typeof makeMockTagRepo>;
  let redis: ReturnType<typeof makeMockRedis>;

  beforeEach(() => {
    tagRepo = makeMockTagRepo();
    redis = makeMockRedis();
    service = new AdminTagService(tagRepo as any, makeMockI18n(), redis as any);
  });

  // ---- getList ----
  describe('getList', () => {
    it('should return paginated tags', async () => {
      tagRepo.findMany.mockResolvedValue([{ id: 1n, name: 'JS' }]);
      tagRepo.count.mockResolvedValue(1);

      const result = await service.getList({});

      expect(result.data).toHaveLength(1);
      expect(result.meta).toEqual({ total: 1 });
    });

    it('should skip count when skipCount is true', async () => {
      tagRepo.findMany.mockResolvedValue([]);
      const result = await service.getList({ skipCount: true });
      expect(tagRepo.count).not.toHaveBeenCalled();
      expect(result.meta).toEqual({ total: 0 });
    });

    it('should apply search filter', async () => {
      tagRepo.findMany.mockResolvedValue([]);
      await service.getList({ search: 'react' });
      expect(tagRepo.findMany).toHaveBeenCalled();
    });

    it('should apply isActive filter', async () => {
      tagRepo.findMany.mockResolvedValue([]);
      await service.getList({ isActive: 'true' });
      expect(tagRepo.findMany).toHaveBeenCalled();
    });
  });

  // ---- getOne ----
  describe('getOne', () => {
    it('should return tag when found', async () => {
      tagRepo.findById.mockResolvedValue({ id: 1n, name: 'JS' });
      const result = await service.getOne(1n);
      expect(result).toEqual({ id: 1n, name: 'JS' });
    });

    it('should throw NotFoundException when not found', async () => {
      tagRepo.findById.mockResolvedValue(null);
      await expect(service.getOne(999n)).rejects.toThrow(NotFoundException);
    });
  });

  // ---- create ----
  describe('create', () => {
    it('should create tag with generated slug', async () => {
      const result = await service.create({ name: 'JavaScript' } as any, 1n);

      expect(tagRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'JavaScript', slug: 'generated-slug', createdUserId: 1n }),
      );
      expect(redis.del).toHaveBeenCalledWith('post:public:tags:list');
      expect(result).toHaveProperty('id');
    });

    it('should create without actorId', async () => {
      const result = await service.create({ name: 'Go' } as any);
      expect(tagRepo.create).toHaveBeenCalledWith(
        expect.not.objectContaining({ createdUserId: expect.anything() }),
      );
      expect(result).toHaveProperty('id');
    });
  });

  // ---- update ----
  describe('update', () => {
    it('should update tag and regenerate slug on name change', async () => {
      tagRepo.findById.mockResolvedValue({ id: 1n, name: 'Old' });
      const result = await service.update(1n, { name: 'New' } as any, 2n);

      expect(tagRepo.update).toHaveBeenCalledWith(
        1n,
        expect.objectContaining({ name: 'New', slug: 'generated-slug', updatedUserId: 2n }),
      );
      expect(redis.del).toHaveBeenCalledWith('post:public:tags:list');
      expect(result).toBeDefined();
    });

    it('should not regenerate slug when name is not provided', async () => {
      tagRepo.findById.mockResolvedValue({ id: 1n, name: 'Same' });
      const { SlugHelper: SH } = require('@package/common');
      SH.uniqueSlug.mockClear();

      await service.update(1n, { description: 'updated desc' } as any);

      expect(SH.uniqueSlug).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when tag not found', async () => {
      tagRepo.findById.mockResolvedValue(null);
      await expect(service.update(999n, { name: 'x' } as any)).rejects.toThrow(NotFoundException);
    });
  });

  // ---- delete ----
  describe('delete', () => {
    it('should delete and invalidate cache', async () => {
      tagRepo.findById.mockResolvedValue({ id: 1n });
      const result = await service.delete(1n);

      expect(tagRepo.delete).toHaveBeenCalledWith(1n);
      expect(redis.del).toHaveBeenCalledWith('post:public:tags:list');
      expect(result).toEqual({ success: true });
    });

    it('should throw NotFoundException when tag not found', async () => {
      tagRepo.findById.mockResolvedValue(null);
      await expect(service.delete(999n)).rejects.toThrow(NotFoundException);
    });
  });
});
