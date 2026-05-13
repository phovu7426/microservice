// ---------------------------------------------------------------------------
// Module mocks — must come before any import that transitively loads them.
// ---------------------------------------------------------------------------
jest.mock('@package/common', () => ({
  t: (_i18n: any, key: string) => key,
  createPaginationMeta: jest.fn((_opts: any, total: number) => ({ total })),
  parseQueryOptions: jest.fn((q: any) => ({ skip: 0, take: q?.take ?? 20 })),
}));

jest.mock('@package/bootstrap', () => ({ FileLogger: jest.fn() }));

jest.mock('nestjs-i18n', () => ({
  I18nContext: { current: () => ({ lang: 'en' }) },
  I18nService: jest.fn(),
}));

jest.mock('src/types', () => ({
  toPrimaryKey: (v: any) => BigInt(v),
}), { virtual: true });

jest.mock('src/generated/prisma', () => ({ Prisma: {}, PrismaClient: class {} }), { virtual: true });
jest.mock('@prisma/adapter-pg', () => ({ PrismaPg: jest.fn() }));
jest.mock('../../../../../src/modules/chapter/repositories/chapter.repository', () => ({
  ChapterRepository: jest.fn(),
}));

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { AdminChapterService } from '../../../../../src/modules/chapter/admin/services/chapter.service';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeMockChapterRepo() {
  return {
    findMany: jest.fn().mockResolvedValue([]),
    count: jest.fn().mockResolvedValue(0),
    findSimpleMany: jest.fn().mockResolvedValue([]),
    findById: jest.fn(),
    findByIndex: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    createPages: jest.fn(),
    deletePages: jest.fn(),
    findPublicOne: jest.fn(),
    withTransaction: jest.fn(async (cb: any) => cb('tx')),
    updateComicLastChapterIfLatest: jest.fn(),
    findComicBasic: jest.fn(),
    createOutbox: jest.fn(),
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

function makeMockConfig() {
  return { get: jest.fn().mockReturnValue(false) };
}

function buildService() {
  const chapterRepo = makeMockChapterRepo();
  const i18n = makeMockI18n();
  const config = makeMockConfig();
  const redis = makeMockRedis();

  const service = new AdminChapterService(
    chapterRepo as any,
    i18n as any,
    config as any,
    redis as any,
  );

  return { service, chapterRepo, i18n, config, redis };
}

const sampleChapter = {
  id: 1n,
  comic_id: 10n,
  title: 'Chapter 1',
  chapter_index: 1,
  chapter_label: 'Ch 1',
  status: 'draft',
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('AdminChapterService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // -----------------------------------------------------------------------
  // getList()
  // -----------------------------------------------------------------------
  describe('getList()', () => {
    it('returns paginated list', async () => {
      const { service, chapterRepo } = buildService();
      chapterRepo.findMany.mockResolvedValue([sampleChapter]);
      chapterRepo.count.mockResolvedValue(1);

      const result = await service.getList({ comicId: 10n });

      expect(result.data).toHaveLength(1);
      expect(chapterRepo.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ comicId: 10n }),
        expect.anything(),
      );
    });

    it('skips count when skipCount is true', async () => {
      const { service, chapterRepo } = buildService();
      chapterRepo.findMany.mockResolvedValue([]);

      await service.getList({ skipCount: 'true' });

      expect(chapterRepo.count).not.toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // getSimpleList()
  // -----------------------------------------------------------------------
  describe('getSimpleList()', () => {
    it('returns simple list filtered by comicId', async () => {
      const { service, chapterRepo } = buildService();
      chapterRepo.findSimpleMany.mockResolvedValue([sampleChapter]);

      const result = await service.getSimpleList({ comicId: 10n });

      expect(result.data).toEqual([sampleChapter]);
      expect(chapterRepo.findSimpleMany).toHaveBeenCalledWith(
        expect.objectContaining({ comicId: 10n }),
        100,
      );
    });

    it('returns empty list when no comicId filter', async () => {
      const { service, chapterRepo } = buildService();
      chapterRepo.findSimpleMany.mockResolvedValue([]);

      const result = await service.getSimpleList({});

      expect(result.data).toEqual([]);
      expect(chapterRepo.findSimpleMany).toHaveBeenCalledWith({}, 100);
    });
  });

  // -----------------------------------------------------------------------
  // getOne()
  // -----------------------------------------------------------------------
  describe('getOne()', () => {
    it('returns chapter by id', async () => {
      const { service, chapterRepo } = buildService();
      chapterRepo.findById.mockResolvedValue(sampleChapter);

      const result = await service.getOne(1n);

      expect(result).toEqual(sampleChapter);
    });

    it('throws NotFoundException when not found', async () => {
      const { service, chapterRepo } = buildService();
      chapterRepo.findById.mockResolvedValue(null);

      await expect(service.getOne(999n)).rejects.toThrow(NotFoundException);
    });
  });

  // -----------------------------------------------------------------------
  // create()
  // -----------------------------------------------------------------------
  describe('create()', () => {
    const dto = {
      comicId: 10n,
      title: 'New Chapter',
      chapterIndex: 2,
      chapterLabel: 'Ch 2',
      status: 'draft',
      pages: [{ imageUrl: 'https://img/1.jpg', width: 800, height: 1200 }],
    } as any;

    it('creates chapter with pages', async () => {
      const { service, chapterRepo } = buildService();
      const created = { ...sampleChapter, id: 2n, chapter_index: 2 };
      chapterRepo.findByIndex.mockResolvedValue(null);
      chapterRepo.create.mockResolvedValue(created);
      chapterRepo.findById.mockResolvedValue(created);

      const result = await service.create(dto, 1n);

      expect(chapterRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          comicId: 10n,
          title: 'New Chapter',
          createdUserId: 1n,
        }),
      );
      expect(chapterRepo.createPages).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ chapterId: 2n, pageNumber: 1, imageUrl: 'https://img/1.jpg' }),
        ]),
      );
      expect(result).toEqual(created);
    });

    it('throws BadRequestException on duplicate chapterIndex', async () => {
      const { service, chapterRepo } = buildService();
      chapterRepo.findByIndex.mockResolvedValue(sampleChapter);

      await expect(service.create(dto)).rejects.toThrow(BadRequestException);
    });

    it('handles publish flow with Kafka outbox when status is published', async () => {
      const { service, chapterRepo, config } = buildService();
      config.get.mockReturnValue(true);
      const created = { ...sampleChapter, id: 2n, status: 'published' };
      chapterRepo.findByIndex.mockResolvedValue(null);
      chapterRepo.create.mockResolvedValue(created);
      chapterRepo.findById.mockResolvedValue(created);
      chapterRepo.findComicBasic.mockResolvedValue({ id: 10n, title: 'Test', slug: 'test' });

      await service.create({ ...dto, status: 'published', pages: [] } as any, 1n);

      expect(chapterRepo.withTransaction).toHaveBeenCalled();
      expect(chapterRepo.updateComicLastChapterIfLatest).toHaveBeenCalled();
      expect(chapterRepo.createOutbox).toHaveBeenCalledWith(
        'comic.chapter.published',
        expect.objectContaining({ comic_id: '10', chapter_id: '2' }),
        'tx',
      );
    });

    it('skips Kafka outbox when kafka is disabled', async () => {
      const { service, chapterRepo, config } = buildService();
      config.get.mockReturnValue(false);
      const created = { ...sampleChapter, id: 2n, status: 'published' };
      chapterRepo.findByIndex.mockResolvedValue(null);
      chapterRepo.create.mockResolvedValue(created);
      chapterRepo.findById.mockResolvedValue(created);

      await service.create({ ...dto, status: 'published', pages: [] } as any);

      expect(chapterRepo.createOutbox).not.toHaveBeenCalled();
    });

    it('clears caches after create', async () => {
      const { service, chapterRepo, redis } = buildService();
      const created = { ...sampleChapter, id: 2n };
      chapterRepo.findByIndex.mockResolvedValue(null);
      chapterRepo.create.mockResolvedValue(created);
      chapterRepo.findById.mockResolvedValue(created);

      await service.create({ ...dto, pages: [] } as any);

      expect(redis.del).toHaveBeenCalledWith('comic:public:chapter:2');
      expect(redis.del).toHaveBeenCalledWith('comic:public:pages:2');
      expect(redis.incr).toHaveBeenCalledWith('comic:public:chapters:v');
      expect(redis.incr).toHaveBeenCalledWith('comic:public:nav:v');
    });
  });

  // -----------------------------------------------------------------------
  // update()
  // -----------------------------------------------------------------------
  describe('update()', () => {
    it('updates chapter fields', async () => {
      const { service, chapterRepo } = buildService();
      chapterRepo.findById.mockResolvedValue(sampleChapter);
      chapterRepo.update.mockResolvedValue({ ...sampleChapter, title: 'Updated' });

      await service.update(1n, { title: 'Updated' } as any, 1n);

      expect(chapterRepo.update).toHaveBeenCalledWith(1n, expect.objectContaining({ title: 'Updated', updatedUserId: 1n }));
    });

    it('replaces pages when pages array provided', async () => {
      const { service, chapterRepo } = buildService();
      chapterRepo.findById.mockResolvedValue(sampleChapter);
      chapterRepo.update.mockResolvedValue(sampleChapter);

      const pages = [{ imageUrl: 'https://img/new.jpg', width: 800, height: 1200 }];
      await service.update(1n, { pages } as any);

      expect(chapterRepo.deletePages).toHaveBeenCalledWith(1n);
      expect(chapterRepo.createPages).toHaveBeenCalledWith(
        expect.arrayContaining([expect.objectContaining({ pageNumber: 1 })]),
      );
    });

    it('triggers publish flow when status changes to published', async () => {
      const { service, chapterRepo, config } = buildService();
      config.get.mockReturnValue(true);
      chapterRepo.findById.mockResolvedValue({ ...sampleChapter, status: 'draft' });
      chapterRepo.update.mockResolvedValue({ ...sampleChapter, status: 'published' });
      chapterRepo.findComicBasic.mockResolvedValue({ id: 10n, title: 'T', slug: 's' });

      await service.update(1n, { status: 'published' } as any);

      expect(chapterRepo.withTransaction).toHaveBeenCalled();
    });

    it('does not trigger publish when already published', async () => {
      const { service, chapterRepo } = buildService();
      chapterRepo.findById.mockResolvedValue({ ...sampleChapter, status: 'published' });
      chapterRepo.update.mockResolvedValue({ ...sampleChapter, status: 'published' });

      await service.update(1n, { status: 'published' } as any);

      expect(chapterRepo.withTransaction).not.toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // delete()
  // -----------------------------------------------------------------------
  describe('delete()', () => {
    it('deletes chapter and clears caches', async () => {
      const { service, chapterRepo, redis } = buildService();
      chapterRepo.findById.mockResolvedValue(sampleChapter);

      const result = await service.delete(1n);

      expect(result).toEqual({ success: true });
      expect(chapterRepo.delete).toHaveBeenCalledWith(1n);
      expect(redis.del).toHaveBeenCalledWith('comic:public:chapter:1');
    });

    it('throws NotFoundException when deleting non-existent chapter', async () => {
      const { service, chapterRepo } = buildService();
      chapterRepo.findById.mockResolvedValue(null);

      await expect(service.delete(999n)).rejects.toThrow(NotFoundException);
    });
  });
});
