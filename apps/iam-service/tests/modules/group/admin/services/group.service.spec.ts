// ---------------------------------------------------------------------------
// Module mocks -- must come before any import
// ---------------------------------------------------------------------------
jest.mock('@package/common', () => ({
  t: (_i18n: any, key: string) => key,
  parseQueryOptions: jest.fn((q: any) => ({ skip: 0, take: 10, orderBy: {} })),
  createPaginationMeta: jest.fn((_opts, total) => ({ total })),
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
  PrismaClient: jest.fn(),
  Prisma: {},
}), { virtual: true });

jest.mock('@prisma/adapter-pg', () => ({
  PrismaPg: jest.fn(),
}));

jest.mock('../../../../../src/core/database/prisma.service', () => ({
  PrismaService: jest.fn(),
}));

jest.mock('../../../../../src/modules/group/repositories/group.repository', () => ({
  GroupRepository: jest.fn(),
}));

jest.mock('../../../../../src/rbac/services/rbac-cache.service', () => ({
  RbacCacheService: jest.fn(),
}));

jest.mock('@package/redis', () => ({
  RedisService: jest.fn(),
}));

jest.mock('../../../../../src/rbac/repositories/rbac.repository', () => ({
  RbacRepository: jest.fn(),
}));

jest.mock('../../../../../src/kafka/services/rbac-event-publisher.service', () => ({
  RbacEventPublisher: jest.fn(),
}));

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------
import { ConflictException, NotFoundException } from '@nestjs/common';
import { GroupService } from '../../../../../src/modules/group/admin/services/group.service';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const MOCK_TX = {} as any;

function makeMockRepo() {
  return {
    findMany: jest.fn(),
    count: jest.fn(),
    findById: jest.fn(),
    findByCode: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    getMembers: jest.fn(),
    countMembers: jest.fn(),
    addMember: jest.fn(),
    removeMember: jest.fn(),
    withTransaction: jest.fn().mockImplementation(async (fn: (tx: any) => Promise<any>) => fn(MOCK_TX)),
  };
}

function makeMockRbacCache() {
  return {
    bumpVersion: jest.fn().mockResolvedValue(undefined),
    clearAllUserCaches: jest.fn().mockResolvedValue(undefined),
  };
}

function makeMockI18n() {
  return {} as any;
}

function makeMockEventPublisher() {
  return {
    publishGroupMemberAdded: jest.fn().mockResolvedValue(undefined),
    publishGroupMemberRemoved: jest.fn().mockResolvedValue(undefined),
    publishGroupDeleted: jest.fn().mockResolvedValue(undefined),
  };
}

function createService(overrides: Record<string, any> = {}) {
  const repo = overrides.repo ?? makeMockRepo();
  const rbacCache = overrides.rbacCache ?? makeMockRbacCache();
  const i18n = overrides.i18n ?? makeMockI18n();
  const eventPublisher = overrides.eventPublisher ?? makeMockEventPublisher();

  const service = new (GroupService as any)(repo, rbacCache, i18n, eventPublisher);
  return { service, repo, rbacCache, i18n, eventPublisher };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('GroupService', () => {
  // --- getOne ---
  describe('getOne', () => {
    it('should return the group when found', async () => {
      const { service, repo } = createService();
      const group = { id: BigInt(1), code: 'team-a', name: 'Team A' };
      repo.findById.mockResolvedValue(group);

      const result = await service.getOne(BigInt(1));
      expect(result).toEqual(group);
    });

    it('should throw NotFoundException when not found', async () => {
      const { service, repo } = createService();
      repo.findById.mockResolvedValue(null);

      await expect(service.getOne(BigInt(999))).rejects.toThrow(NotFoundException);
    });
  });

  // --- create ---
  describe('create', () => {
    it('should create a group when code is unique', async () => {
      const { service, repo } = createService();
      repo.findByCode.mockResolvedValue(null);
      const created = { id: BigInt(1), code: 'team-b' };
      repo.create.mockResolvedValue(created);

      const result = await service.create(
        { type: 'team', code: 'team-b', name: 'Team B', context_id: BigInt(1) } as any,
        BigInt(100),
      );
      expect(result).toEqual(created);
    });

    it('should throw ConflictException when code exists', async () => {
      const { service, repo } = createService();
      repo.findByCode.mockResolvedValue({ id: BigInt(1) });

      await expect(
        service.create({ code: 'dup' } as any, BigInt(100)),
      ).rejects.toThrow(ConflictException);
    });

    it('should include owner_id when provided', async () => {
      const { service, repo } = createService();
      repo.findByCode.mockResolvedValue(null);
      repo.create.mockResolvedValue({ id: BigInt(1) });

      await service.create(
        { type: 'team', code: 'x', name: 'X', contextId: '1', ownerId: '50' } as any,
        BigInt(100),
      );
      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ ownerId: '50' }),
      );
    });
  });

  // --- update ---
  describe('update', () => {
    it('should update the group', async () => {
      const { service, repo } = createService();
      repo.findById.mockResolvedValue({ id: BigInt(1) });
      repo.update.mockResolvedValue({ id: BigInt(1), name: 'Updated' });

      const result = await service.update(BigInt(1), { name: 'Updated' } as any, BigInt(100));
      expect(result.name).toBe('Updated');
    });

    it('should bump cache when status changes', async () => {
      const { service, repo, rbacCache } = createService();
      repo.findById.mockResolvedValue({ id: BigInt(1) });
      repo.update.mockResolvedValue({ id: BigInt(1) });

      await service.update(BigInt(1), { status: 'inactive' } as any, BigInt(100));
      expect(rbacCache.bumpVersion).toHaveBeenCalled();
    });

    it('should not bump cache when status is unchanged', async () => {
      const { service, repo, rbacCache } = createService();
      repo.findById.mockResolvedValue({ id: BigInt(1) });
      repo.update.mockResolvedValue({ id: BigInt(1) });

      await service.update(BigInt(1), { name: 'New Name' } as any, BigInt(100));
      expect(rbacCache.bumpVersion).not.toHaveBeenCalled();
    });

    it('should nullify owner_id when explicitly set to falsy', async () => {
      const { service, repo } = createService();
      repo.findById.mockResolvedValue({ id: BigInt(1) });
      repo.update.mockResolvedValue({ id: BigInt(1) });

      await service.update(BigInt(1), { ownerId: null } as any, BigInt(100));
      expect(repo.update).toHaveBeenCalledWith(
        BigInt(1),
        expect.objectContaining({ ownerId: null }),
      );
    });
  });

  // --- delete ---
  describe('delete', () => {
    it('should delete, publish event, and bump cache', async () => {
      const { service, repo, rbacCache, eventPublisher } = createService();
      repo.findById.mockResolvedValue({ id: BigInt(1) });

      const result = await service.delete(BigInt(1));

      expect(result.message).toBe('group.DELETED');
      expect(repo.withTransaction).toHaveBeenCalled();
      expect(repo.delete).toHaveBeenCalledWith(BigInt(1), MOCK_TX);
      expect(eventPublisher.publishGroupDeleted).toHaveBeenCalledWith(
        { groupId: BigInt(1) },
        MOCK_TX,
      );
      expect(rbacCache.bumpVersion).toHaveBeenCalled();
    });

    it('should throw NotFoundException when not found', async () => {
      const { service, repo } = createService();
      repo.findById.mockResolvedValue(null);

      await expect(service.delete(BigInt(999))).rejects.toThrow(NotFoundException);
    });
  });

  // --- getMembers ---
  describe('getMembers', () => {
    it('should return paginated members', async () => {
      const { service, repo } = createService();
      repo.findById.mockResolvedValue({ id: BigInt(1) });
      repo.getMembers.mockResolvedValue([{ userId: 'u1' }]);
      repo.countMembers.mockResolvedValue(1);

      const result = await service.getMembers(BigInt(1), {});
      expect(result.data).toHaveLength(1);
      expect(result.meta).toBeDefined();
    });
  });

  // --- addMember ---
  describe('addMember', () => {
    it('should call withTransaction, pass tx to addMember and publishGroupMemberAdded, then clear cache', async () => {
      const { service, repo, rbacCache, eventPublisher } = createService();
      repo.findById.mockResolvedValue({ id: BigInt(1) });

      const result = await service.addMember(BigInt(1), { userId: BigInt(42) } as any);

      expect(result.message).toBe('group.MEMBER_ADDED');
      expect(repo.withTransaction).toHaveBeenCalled();
      expect(repo.addMember).toHaveBeenCalledWith(BigInt(1), BigInt(42), MOCK_TX);
      expect(eventPublisher.publishGroupMemberAdded).toHaveBeenCalledWith(
        { groupId: BigInt(1), userId: BigInt(42) },
        MOCK_TX,
      );
      expect(rbacCache.clearAllUserCaches).toHaveBeenCalledWith(BigInt(42));
    });
  });

  // --- removeMember ---
  describe('removeMember', () => {
    it('should call withTransaction, pass tx to removeMember and publishGroupMemberRemoved, then clear cache', async () => {
      const { service, repo, rbacCache, eventPublisher } = createService();
      repo.findById.mockResolvedValue({ id: BigInt(1) });

      const result = await service.removeMember(BigInt(1), BigInt(42));

      expect(result.message).toBe('group.MEMBER_REMOVED');
      expect(repo.withTransaction).toHaveBeenCalled();
      expect(repo.removeMember).toHaveBeenCalledWith(BigInt(1), BigInt(42), MOCK_TX);
      expect(eventPublisher.publishGroupMemberRemoved).toHaveBeenCalledWith(
        { groupId: BigInt(1), userId: BigInt(42) },
        MOCK_TX,
      );
      expect(rbacCache.clearAllUserCaches).toHaveBeenCalledWith(BigInt(42));
    });
  });
});
