// ---------------------------------------------------------------------------
// Module mocks — must come before any import that transitively loads them.
// ---------------------------------------------------------------------------
jest.mock('@package/common', () => ({
  t: (_i18n: any, key: string) => key,
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
jest.mock('../../../../../src/modules/comment/repositories/comment.repository', () => ({
  CommentRepository: jest.fn(),
}));

jest.mock('../../../../../src/modules/comic/enums/comic-status.enum', () => ({
  ComicStatus: { published: 'published' },
  PUBLIC_COMIC_STATUSES: ['published'],
}));

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { UserCommentService } from '../../../../../src/modules/comment/user/services/comments.service';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeMockCommentRepo() {
  return {
    existsPublicComic: jest.fn().mockResolvedValue(true),
    existsPublishedChapter: jest.fn().mockResolvedValue(true),
    findById: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    withTransaction: jest.fn(async (cb: any) => cb('tx')),
    createOutbox: jest.fn(),
  };
}

function makeMockRedis() {
  return {
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
  const commentRepo = makeMockCommentRepo();
  const i18n = makeMockI18n();
  const config = makeMockConfig();
  const redis = makeMockRedis();

  const service = new UserCommentService(
    commentRepo as any,
    i18n as any,
    config as any,
    redis as any,
  );

  return { service, commentRepo, i18n, config, redis };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('UserCommentService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // -----------------------------------------------------------------------
  // create()
  // -----------------------------------------------------------------------
  describe('create()', () => {
    const dto = { comicId: 10n, content: 'Great comic!' } as any;

    it('creates a top-level comment', async () => {
      const { service, commentRepo } = buildService();
      const created = { id: 1n, ...dto, user_id: 1n };
      commentRepo.create.mockResolvedValue(created);

      const result = await service.create(1n, dto);

      expect(result).toEqual(created);
      expect(commentRepo.existsPublicComic).toHaveBeenCalledWith(10n, ['published']);
    });

    it('throws NotFoundException when comic does not exist or is not public', async () => {
      const { service, commentRepo } = buildService();
      commentRepo.existsPublicComic.mockResolvedValue(false);

      await expect(service.create(1n, dto)).rejects.toThrow(NotFoundException);
    });

    it('validates chapter belongs to comic', async () => {
      const { service, commentRepo } = buildService();
      commentRepo.existsPublishedChapter.mockResolvedValue(false);
      const dtoWithChapter = { ...dto, chapterId: 100n };

      await expect(service.create(1n, dtoWithChapter)).rejects.toThrow(BadRequestException);
    });

    it('creates a reply to a parent comment', async () => {
      const { service, commentRepo } = buildService();
      const parent = { id: 5n, userId: 2n, comicId: 10n, parentId: null };
      commentRepo.findById.mockResolvedValue(parent);
      commentRepo.create.mockResolvedValue({ id: 6n, parentId: 5n });

      const result = await service.create(1n, { ...dto, parentId: 5n });

      expect(result.parentId).toBe(5n);
    });

    it('throws NotFoundException when parent comment not found', async () => {
      const { service, commentRepo } = buildService();
      commentRepo.findById.mockResolvedValue(null);

      await expect(service.create(1n, { ...dto, parentId: 999n })).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when parent belongs to different comic', async () => {
      const { service, commentRepo } = buildService();
      commentRepo.findById.mockResolvedValue({ id: 5n, userId: 2n, comicId: 99n, parentId: null });

      await expect(service.create(1n, { ...dto, parentId: 5n })).rejects.toThrow(ForbiddenException);
    });

    it('throws BadRequestException when reply depth exceeds 1', async () => {
      const { service, commentRepo } = buildService();
      // parent itself has a parentId, so it's already depth 1
      commentRepo.findById.mockResolvedValue({ id: 5n, userId: 2n, comicId: 10n, parentId: 3n });

      await expect(service.create(1n, { ...dto, parentId: 5n })).rejects.toThrow(BadRequestException);
    });

    it('creates Kafka outbox when replying to another user with kafka enabled', async () => {
      const { service, commentRepo, config } = buildService();
      config.get.mockReturnValue(true);
      const parent = { id: 5n, userId: 2n, comicId: 10n, parentId: null };
      commentRepo.findById.mockResolvedValue(parent);
      commentRepo.create.mockResolvedValue({ id: 6n, parentId: 5n });

      await service.create(1n, { ...dto, parentId: 5n });

      expect(commentRepo.createOutbox).toHaveBeenCalledWith(
        'comic.comment.created',
        expect.objectContaining({
          parent_comment_user_id: '2',
          user_id: '1',
        }),
        'tx',
      );
    });

    it('does not create outbox when replying to own comment', async () => {
      const { service, commentRepo, config } = buildService();
      config.get.mockReturnValue(true);
      const parent = { id: 5n, userId: 1n, comicId: 10n, parentId: null };
      commentRepo.findById.mockResolvedValue(parent);
      commentRepo.create.mockResolvedValue({ id: 6n });

      await service.create(1n, { ...dto, parentId: 5n });

      expect(commentRepo.createOutbox).not.toHaveBeenCalled();
    });

    it('increments version cache after create', async () => {
      const { service, commentRepo, redis } = buildService();
      commentRepo.create.mockResolvedValue({ id: 1n });

      await service.create(1n, dto);

      expect(redis.incr).toHaveBeenCalledWith('comic:public:comments:v');
    });
  });

  // -----------------------------------------------------------------------
  // update()
  // -----------------------------------------------------------------------
  describe('update()', () => {
    it('updates comment content', async () => {
      const { service, commentRepo } = buildService();
      commentRepo.findById.mockResolvedValue({ id: 1n, user_id: 1n });
      commentRepo.update.mockResolvedValue({ id: 1n, content: 'Updated' });

      const result = await service.update(1n, 1n, 'Updated');

      expect(commentRepo.update).toHaveBeenCalledWith(1n, { content: 'Updated' });
      expect(result.content).toBe('Updated');
    });

    it('throws NotFoundException when comment not found', async () => {
      const { service, commentRepo } = buildService();
      commentRepo.findById.mockResolvedValue(null);

      await expect(service.update(1n, 999n, 'x')).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when not owner', async () => {
      const { service, commentRepo } = buildService();
      commentRepo.findById.mockResolvedValue({ id: 1n, user_id: 2n });

      await expect(service.update(1n, 1n, 'x')).rejects.toThrow(ForbiddenException);
    });
  });

  // -----------------------------------------------------------------------
  // delete()
  // -----------------------------------------------------------------------
  describe('delete()', () => {
    it('soft-deletes by setting status to deleted', async () => {
      const { service, commentRepo } = buildService();
      commentRepo.findById.mockResolvedValue({ id: 1n, user_id: 1n });
      commentRepo.update.mockResolvedValue({ id: 1n, status: 'deleted' });

      const result = await service.delete(1n, 1n);

      expect(commentRepo.update).toHaveBeenCalledWith(1n, { status: 'deleted' });
      expect(result.status).toBe('deleted');
    });

    it('throws NotFoundException when comment not found', async () => {
      const { service, commentRepo } = buildService();
      commentRepo.findById.mockResolvedValue(null);

      await expect(service.delete(1n, 999n)).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when not owner', async () => {
      const { service, commentRepo } = buildService();
      commentRepo.findById.mockResolvedValue({ id: 1n, user_id: 2n });

      await expect(service.delete(1n, 1n)).rejects.toThrow(ForbiddenException);
    });
  });
});
