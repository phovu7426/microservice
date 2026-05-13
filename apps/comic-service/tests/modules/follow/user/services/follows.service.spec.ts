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
  toPrimaryKey: (v: string) => BigInt(v),
}), { virtual: true });

jest.mock('src/generated/prisma', () => ({ Prisma: {}, PrismaClient: class {} }), { virtual: true });
jest.mock('@prisma/adapter-pg', () => ({ PrismaPg: jest.fn() }));
jest.mock('../../../../../src/modules/follow/repositories/follow.repository', () => ({
  FollowRepository: jest.fn(),
}));

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------
import { ConflictException, NotFoundException } from '@nestjs/common';
import { UserFollowService } from '../../../../../src/modules/follow/user/services/follows.service';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeMockFollowRepo() {
  return {
    findMany: jest.fn().mockResolvedValue([]),
    count: jest.fn().mockResolvedValue(0),
    findUnique: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
    incrementFollowCount: jest.fn(),
    decrementFollowCount: jest.fn(),
    withTransaction: jest.fn(async (cb: any) => cb('tx')),
    createOutbox: jest.fn(),
  };
}

function makeMockI18n() {
  return { t: jest.fn((key: string) => key) };
}

function makeMockConfig() {
  return { get: jest.fn().mockReturnValue(false) };
}

function buildService() {
  const followRepo = makeMockFollowRepo();
  const i18n = makeMockI18n();
  const config = makeMockConfig();

  const service = new UserFollowService(
    followRepo as any,
    i18n as any,
    config as any,
  );

  return { service, followRepo, i18n, config };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('UserFollowService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // -----------------------------------------------------------------------
  // getList()
  // -----------------------------------------------------------------------
  describe('getList()', () => {
    it('returns paginated follow list for user', async () => {
      const { service, followRepo } = buildService();
      const follows = [{ id: 1n, user_id: 1n, comic_id: 10n }];
      followRepo.findMany.mockResolvedValue(follows);
      followRepo.count.mockResolvedValue(1);

      const result = await service.getList(1n, {});

      expect(result.data).toEqual(follows);
      expect(followRepo.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 1n }),
        expect.anything(),
      );
    });
  });

  // -----------------------------------------------------------------------
  // follow()
  // -----------------------------------------------------------------------
  describe('follow()', () => {
    it('creates follow, increments count in transaction', async () => {
      const { service, followRepo } = buildService();
      followRepo.findUnique.mockResolvedValue(null);
      const follow = { id: 1n, user_id: 1n, comic_id: 10n };
      followRepo.create.mockResolvedValue(follow);

      const result = await service.follow(1n, 10n);

      expect(result).toEqual(follow);
      expect(followRepo.findUnique).toHaveBeenCalledWith(1n, 10n, 'tx');
      expect(followRepo.create).toHaveBeenCalledWith(1n, 10n, 'tx');
      expect(followRepo.incrementFollowCount).toHaveBeenCalledWith(10n, 'tx');
    });

    it('throws ConflictException when already following', async () => {
      const { service, followRepo } = buildService();
      followRepo.findUnique.mockResolvedValue({ id: 1n });

      await expect(service.follow(1n, 10n)).rejects.toThrow(ConflictException);
    });

    it('creates Kafka outbox when kafka enabled', async () => {
      const { service, followRepo, config } = buildService();
      config.get.mockReturnValue(true);
      followRepo.findUnique.mockResolvedValue(null);
      followRepo.create.mockResolvedValue({ id: 1n });

      await service.follow(1n, 10n);

      expect(followRepo.createOutbox).toHaveBeenCalledWith(
        'user.followed.comic',
        expect.objectContaining({ user_id: '1', comic_id: '10' }),
        'tx',
      );
    });

    it('does not create outbox when kafka disabled', async () => {
      const { service, followRepo, config } = buildService();
      config.get.mockReturnValue(false);
      followRepo.findUnique.mockResolvedValue(null);
      followRepo.create.mockResolvedValue({ id: 1n });

      await service.follow(1n, 10n);

      expect(followRepo.createOutbox).not.toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // unfollow()
  // -----------------------------------------------------------------------
  describe('unfollow()', () => {
    it('deletes follow, decrements count in transaction', async () => {
      const { service, followRepo } = buildService();
      followRepo.findUnique.mockResolvedValue({ id: 1n });

      const result = await service.unfollow(1n, 10n);

      expect(result).toEqual({ success: true });
      expect(followRepo.delete).toHaveBeenCalledWith(1n, 10n, 'tx');
      expect(followRepo.decrementFollowCount).toHaveBeenCalledWith(10n, 'tx');
    });

    it('throws NotFoundException when not following', async () => {
      const { service, followRepo } = buildService();
      followRepo.findUnique.mockResolvedValue(null);

      await expect(service.unfollow(1n, 10n)).rejects.toThrow(NotFoundException);
    });

    it('creates Kafka outbox on unfollow when kafka enabled', async () => {
      const { service, followRepo, config } = buildService();
      config.get.mockReturnValue(true);
      followRepo.findUnique.mockResolvedValue({ id: 1n });

      await service.unfollow(1n, 10n);

      expect(followRepo.createOutbox).toHaveBeenCalledWith(
        'user.unfollowed.comic',
        expect.objectContaining({ user_id: '1', comic_id: '10' }),
        'tx',
      );
    });
  });
});
