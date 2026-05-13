// ---------------------------------------------------------------------------
// Module mocks — must come before any import that transitively loads them.
// ---------------------------------------------------------------------------
jest.mock('@package/common', () => ({
  t: (_i18n: any, key: string) => key,
  createPaginationMeta: jest.fn((_opts: any, total: number) => ({ total })),
  parseQueryOptions: jest.fn((q: any) => ({ skip: 0, take: q?.take ?? 20 })),
  SlugHelper: {
    uniqueSlug: jest.fn(async (title: string) => `${title}-slug`),
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

jest.mock('src/generated/prisma', () => ({
  Prisma: {
    PrismaClientKnownRequestError: class PrismaClientKnownRequestError extends Error {
      code: string;
      constructor(message: string, opts: { code: string; clientVersion: string }) {
        super(message);
        this.code = opts.code;
      }
    },
  },
  PrismaClient: class {},
}), { virtual: true });

jest.mock('@prisma/adapter-pg', () => ({ PrismaPg: jest.fn() }));

jest.mock('../../../../../src/modules/comic/repositories/comic.repository', () => ({
  ComicRepository: jest.fn(),
}));

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { AdminComicService } from '../../../../../src/modules/comic/admin/services/comic.service';
import { SlugHelper } from '@package/common';
import { Prisma } from 'src/generated/prisma';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeMockComicRepo() {
  return {
    findMany: jest.fn().mockResolvedValue([]),
    count: jest.fn().mockResolvedValue(0),
    findSimpleMany: jest.fn().mockResolvedValue([]),
    findById: jest.fn(),
    findBySlugSimple: jest.fn(),
    createWithRelations: jest.fn(),
    updateWithRelations: jest.fn(),
    delete: jest.fn(),
  };
}

function makeMockRedis() {
  return {
    del: jest.fn().mockResolvedValue(1),
    incr: jest.fn().mockResolvedValue(1),
    isEnabled: jest.fn().mockReturnValue(true),
  };
}

function makeMockI18n() {
  return { t: jest.fn((key: string) => key) };
}

function buildService() {
  const comicRepo = makeMockComicRepo();
  const i18n = makeMockI18n();
  const redis = makeMockRedis();

  const service = new AdminComicService(
    comicRepo as any,
    i18n as any,
    redis as any,
  );

  return { service, comicRepo, i18n, redis };
}

const sampleComic = {
  id: 1n,
  title: 'Test Comic',
  slug: 'test-comic-slug',
  categoryLinks: [
    { category: { id: 10n, name: 'Action' } },
    { category: { id: 20n, name: 'Adventure' } },
  ],
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('AdminComicService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // -----------------------------------------------------------------------
  // getList()
  // -----------------------------------------------------------------------
  describe('getList()', () => {
    it('returns paginated list with transformed categories', async () => {
      const { service, comicRepo } = buildService();
      comicRepo.findMany.mockResolvedValue([sampleComic]);
      comicRepo.count.mockResolvedValue(1);

      const result = await service.getList({});

      expect(result.data).toHaveLength(1);
      expect(result.data[0].categories).toEqual([
        { id: 10n, name: 'Action' },
        { id: 20n, name: 'Adventure' },
      ]);
      expect(result.data[0].category_ids).toEqual([10n, 20n]);
      expect(result.data[0].categoryLinks).toBeUndefined();
    });

    it('skips count when skipCount is true', async () => {
      const { service, comicRepo } = buildService();
      comicRepo.findMany.mockResolvedValue([]);

      await service.getList({ skipCount: true });

      expect(comicRepo.count).not.toHaveBeenCalled();
    });

    it('builds filter from query params', async () => {
      const { service, comicRepo } = buildService();
      comicRepo.findMany.mockResolvedValue([]);

      await service.getList({ search: 'naruto', status: 'published', isFeatured: 'true', categoryId: '5' });

      expect(comicRepo.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          search: 'naruto',
          status: 'published',
          isFeatured: true,
          categoryId: '5',
        }),
        expect.anything(),
      );
    });
  });

  // -----------------------------------------------------------------------
  // getSimpleList()
  // -----------------------------------------------------------------------
  describe('getSimpleList()', () => {
    it('caps limit to 200', async () => {
      const { service, comicRepo } = buildService();
      comicRepo.findSimpleMany.mockResolvedValue([]);

      await service.getSimpleList({ limit: 999 });

      expect(comicRepo.findSimpleMany).toHaveBeenCalledWith(expect.anything(), 200);
    });

    it('defaults limit to 50', async () => {
      const { service, comicRepo } = buildService();
      comicRepo.findSimpleMany.mockResolvedValue([]);

      await service.getSimpleList({});

      expect(comicRepo.findSimpleMany).toHaveBeenCalledWith(expect.anything(), 50);
    });
  });

  // -----------------------------------------------------------------------
  // getOne()
  // -----------------------------------------------------------------------
  describe('getOne()', () => {
    it('returns transformed comic by id', async () => {
      const { service, comicRepo } = buildService();
      comicRepo.findById.mockResolvedValue(sampleComic);

      const result = await service.getOne(1n);

      expect(result).toBeDefined();
      expect(result!.categories).toHaveLength(2);
    });

    it('throws NotFoundException when not found', async () => {
      const { service, comicRepo } = buildService();
      comicRepo.findById.mockResolvedValue(null);

      await expect(service.getOne(999n)).rejects.toThrow(NotFoundException);
    });
  });

  // -----------------------------------------------------------------------
  // create()
  // -----------------------------------------------------------------------
  describe('create()', () => {
    const dto = { title: 'New Comic', categoryIds: [10n] } as any;

    it('creates comic with generated slug and clears cache', async () => {
      const { service, comicRepo, redis } = buildService();
      const created = { ...sampleComic, slug: 'New Comic-slug' };
      comicRepo.createWithRelations.mockResolvedValue(created);

      const result = await service.create(dto, 1n);

      expect(SlugHelper.uniqueSlug).toHaveBeenCalledWith(dto.title, expect.anything());
      expect(comicRepo.createWithRelations).toHaveBeenCalledWith(
        expect.objectContaining({ slug: 'New Comic-slug', createdUserId: 1n }),
        dto.categoryIds,
      );
      expect(redis.del).toHaveBeenCalledWith('comic:public:detail:New Comic-slug');
      expect(redis.incr).toHaveBeenCalledWith('comic:public:list:v');
      expect(result).toBeDefined();
    });

    it('retries on P2002 up to 2 times then throws BadRequest', async () => {
      const { service, comicRepo } = buildService();
      const p2002 = new (Prisma.PrismaClientKnownRequestError as any)('dup', {
        code: 'P2002',
        clientVersion: '5.0.0',
      });
      comicRepo.createWithRelations.mockRejectedValue(p2002);

      await expect(service.create(dto)).rejects.toThrow(BadRequestException);

      // 1 initial + 2 retries = 3 attempts
      expect(comicRepo.createWithRelations).toHaveBeenCalledTimes(3);
    });

    it('rethrows non-P2002 errors immediately', async () => {
      const { service, comicRepo } = buildService();
      comicRepo.createWithRelations.mockRejectedValue(new Error('DB down'));

      await expect(service.create(dto)).rejects.toThrow('DB down');
      expect(comicRepo.createWithRelations).toHaveBeenCalledTimes(1);
    });
  });

  // -----------------------------------------------------------------------
  // update()
  // -----------------------------------------------------------------------
  describe('update()', () => {
    it('regenerates slug when title changes', async () => {
      const { service, comicRepo } = buildService();
      comicRepo.findById.mockResolvedValue(sampleComic);
      comicRepo.updateWithRelations.mockResolvedValue({ ...sampleComic, title: 'Updated', slug: 'Updated-slug' });

      await service.update(1n, { title: 'Updated' } as any, 1n);

      expect(SlugHelper.uniqueSlug).toHaveBeenCalledWith('Updated', expect.anything(), 1n);
    });

    it('does not regenerate slug when title unchanged', async () => {
      const { service, comicRepo } = buildService();
      comicRepo.findById.mockResolvedValue(sampleComic);
      comicRepo.updateWithRelations.mockResolvedValue(sampleComic);

      await service.update(1n, { title: 'Test Comic' } as any);

      expect(SlugHelper.uniqueSlug).not.toHaveBeenCalled();
    });

    it('throws BadRequest on P2002', async () => {
      const { service, comicRepo } = buildService();
      comicRepo.findById.mockResolvedValue(sampleComic);
      const p2002 = new (Prisma.PrismaClientKnownRequestError as any)('dup', {
        code: 'P2002',
        clientVersion: '5.0.0',
      });
      comicRepo.updateWithRelations.mockRejectedValue(p2002);

      await expect(service.update(1n, { slug: 'taken' } as any)).rejects.toThrow(BadRequestException);
    });

    it('clears caches after update', async () => {
      const { service, comicRepo, redis } = buildService();
      comicRepo.findById.mockResolvedValue(sampleComic);
      comicRepo.updateWithRelations.mockResolvedValue({ ...sampleComic, slug: 'new-slug' });

      await service.update(1n, { title: 'X' } as any);

      expect(redis.del).toHaveBeenCalled();
      expect(redis.incr).toHaveBeenCalledWith('comic:public:list:v');
    });
  });

  // -----------------------------------------------------------------------
  // delete()
  // -----------------------------------------------------------------------
  describe('delete()', () => {
    it('deletes and clears caches', async () => {
      const { service, comicRepo, redis } = buildService();
      comicRepo.findById.mockResolvedValue(sampleComic);

      const result = await service.delete(1n);

      expect(result).toEqual({ success: true });
      expect(comicRepo.delete).toHaveBeenCalledWith(1n);
      expect(redis.del).toHaveBeenCalledWith(`comic:public:detail:${sampleComic.slug}`);
    });

    it('throws NotFoundException when deleting non-existent comic', async () => {
      const { service, comicRepo } = buildService();
      comicRepo.findById.mockResolvedValue(null);

      await expect(service.delete(999n)).rejects.toThrow(NotFoundException);
    });
  });
});
