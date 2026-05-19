// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------
jest.mock('@package/common', () => ({
  t: (_i18n: any, key: string) => key,
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

jest.mock('../../../../../src/modules/comment/repositories/comment.repository', () => ({
  CommentRepository: jest.fn(),
}));

jest.mock('../../../../../src/modules/post/enums/post-status.enum', () => ({
  PUBLIC_POST_STATUSES: ['published'],
}));

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { UserCommentService } from '../../../../../src/modules/comment/user/services/comment.service';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeMockCommentRepo() {
  return {
    existsPublicPost: jest.fn().mockResolvedValue({ id: 1n, status: 'published' }),
    findById: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockImplementation((data) => Promise.resolve({ id: 100n, ...data })),
    createOutbox: jest.fn().mockResolvedValue(undefined),
    withTransaction: jest.fn().mockImplementation((fn) => fn({})),
    update: jest.fn().mockResolvedValue({ id: 100n }),
    delete: jest.fn().mockResolvedValue(undefined),
  };
}

function makeMockConfig(eventDriver = 'local') {
  return {
    // Default 'local' → eventEnabled = false, no outbox created.
    get: jest.fn().mockImplementation((_key: string, def?: any) =>
      _key === 'EVENT_DRIVER' ? eventDriver : def,
    ),
  };
}

function makeMockI18n() {
  return {} as any;
}

function makeMockRedis() {
  return {
    incr: jest.fn().mockResolvedValue(1),
    isEnabled: jest.fn().mockReturnValue(true),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('UserCommentService', () => {
  let service: UserCommentService;
  let commentRepo: ReturnType<typeof makeMockCommentRepo>;
  let config: ReturnType<typeof makeMockConfig>;
  let redis: ReturnType<typeof makeMockRedis>;

  const userId = 10n;

  beforeEach(() => {
    commentRepo = makeMockCommentRepo();
    config = makeMockConfig();
    redis = makeMockRedis();
    service = new UserCommentService(
      commentRepo as any,
      config as any,
      makeMockI18n(),
      redis as any,
    );
  });

  // ---- create ----
  describe('create', () => {
    const baseDto = { postId: '1', content: 'Nice post!' } as any;

    it('should create a comment on a public post', async () => {
      const result = await service.create(userId, baseDto);

      expect(commentRepo.existsPublicPost).toHaveBeenCalled();
      expect(commentRepo.withTransaction).toHaveBeenCalled();
      expect(commentRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: userId,
          postId: '1',
          content: 'Nice post!',
        }),
        expect.anything(),
      );
      expect(redis.incr).toHaveBeenCalledWith('post:public:comments:v');
      expect(result).toHaveProperty('id');
    });

    it('should throw NotFoundException if post does not exist', async () => {
      commentRepo.existsPublicPost.mockResolvedValue(null);
      await expect(service.create(userId, baseDto)).rejects.toThrow(NotFoundException);
    });

    it('should allow reply to existing parent comment', async () => {
      const parent = { id: 50n, postId: 1n, userId: 20n, parentId: null };
      commentRepo.findById.mockResolvedValue(parent);

      const dto = { ...baseDto, parentId: '50' };
      await service.create(userId, dto);

      expect(commentRepo.findById).toHaveBeenCalledWith('50');
      expect(commentRepo.create).toHaveBeenCalled();
    });

    it('should throw NotFoundException when parent comment not found', async () => {
      commentRepo.findById.mockResolvedValue(null);
      const dto = { ...baseDto, parentId: '999' };
      await expect(service.create(userId, dto)).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when parent belongs to different post', async () => {
      const parent = { id: 50n, postId: 999n, userId: 20n, parentId: null };
      commentRepo.findById.mockResolvedValue(parent);

      const dto = { ...baseDto, parentId: '50' };
      await expect(service.create(userId, dto)).rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException when reply depth exceeds limit', async () => {
      const parent = { id: 50n, postId: 1n, userId: 20n, parentId: 30n };
      commentRepo.findById.mockResolvedValue(parent);

      const dto = { ...baseDto, parentId: '50' };
      await expect(service.create(userId, dto)).rejects.toThrow(BadRequestException);
    });

    it('should create outbox when event driver is kafka and replying to another user', async () => {
      service = new UserCommentService(
        commentRepo as any,
        makeMockConfig('kafka') as any,
        makeMockI18n(),
        redis as any,
      );
      const parent = { id: 50n, postId: 1n, userId: 20n, parentId: null };
      commentRepo.findById.mockResolvedValue(parent);

      const dto = { ...baseDto, parentId: '50' };
      await service.create(userId, dto);

      expect(commentRepo.createOutbox).toHaveBeenCalledWith(
        'post.comment.created',
        expect.objectContaining({
          parent_comment_user_id: '20',
        }),
        expect.anything(),
      );
    });

    it('should create outbox when event driver is rabbitmq and replying to another user', async () => {
      service = new UserCommentService(
        commentRepo as any,
        makeMockConfig('rabbitmq') as any,
        makeMockI18n(),
        redis as any,
      );
      const parent = { id: 50n, postId: 1n, userId: 20n, parentId: null };
      commentRepo.findById.mockResolvedValue(parent);

      const dto = { ...baseDto, parentId: '50' };
      await service.create(userId, dto);

      expect(commentRepo.createOutbox).toHaveBeenCalledWith(
        'post.comment.created',
        expect.objectContaining({ parent_comment_user_id: '20' }),
        expect.anything(),
      );
    });

    it('should NOT create outbox when replying to own comment', async () => {
      service = new UserCommentService(
        commentRepo as any,
        makeMockConfig('kafka') as any,
        makeMockI18n(),
        redis as any,
      );
      const parent = { id: 50n, postId: 1n, userId: userId, parentId: null };
      commentRepo.findById.mockResolvedValue(parent);

      const dto = { ...baseDto, parentId: '50' };
      await service.create(userId, dto);

      expect(commentRepo.createOutbox).not.toHaveBeenCalled();
    });

    it('should NOT create outbox when EVENT_DRIVER is local', async () => {
      // default service already uses makeMockConfig('local')
      const parent = { id: 50n, postId: 1n, userId: 20n, parentId: null };
      commentRepo.findById.mockResolvedValue(parent);

      const dto = { ...baseDto, parentId: '50' };
      await service.create(userId, dto);

      expect(commentRepo.createOutbox).not.toHaveBeenCalled();
    });
  });

  // ---- update ----
  describe('update', () => {
    it('should update own comment', async () => {
      commentRepo.findById.mockResolvedValue({ id: 100n, userId: userId });
      const result = await service.update(userId, 100n, 'Updated text');

      expect(commentRepo.update).toHaveBeenCalledWith(100n, {
        content: 'Updated text',
        updatedUserId: userId,
      });
      expect(redis.incr).toHaveBeenCalledWith('post:public:comments:v');
      expect(result).toBeDefined();
    });

    it('should throw NotFoundException when comment not found', async () => {
      commentRepo.findById.mockResolvedValue(null);
      await expect(service.update(userId, 999n, 'text')).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when updating other user comment', async () => {
      commentRepo.findById.mockResolvedValue({ id: 100n, userId: 999n });
      await expect(service.update(userId, 100n, 'text')).rejects.toThrow(ForbiddenException);
    });
  });

  // ---- delete ----
  describe('delete', () => {
    it('should delete own comment', async () => {
      commentRepo.findById.mockResolvedValue({ id: 100n, userId: userId });
      const result = await service.delete(userId, 100n);

      expect(commentRepo.delete).toHaveBeenCalledWith(100n);
      expect(redis.incr).toHaveBeenCalledWith('post:public:comments:v');
      expect(result).toEqual({ success: true });
    });

    it('should throw NotFoundException when comment not found', async () => {
      commentRepo.findById.mockResolvedValue(null);
      await expect(service.delete(userId, 999n)).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when deleting other user comment', async () => {
      commentRepo.findById.mockResolvedValue({ id: 100n, userId: 999n });
      await expect(service.delete(userId, 100n)).rejects.toThrow(ForbiddenException);
    });
  });
});
