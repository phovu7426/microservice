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

jest.mock('../../../../../src/modules/context/repositories/context.repository', () => ({
  ContextRepository: jest.fn(),
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

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------
import { ConflictException, NotFoundException } from '@nestjs/common';
import { ContextService } from '../../../../../src/modules/context/admin/services/context.service';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeMockRepo() {
  return {
    findMany: jest.fn(),
    count: jest.fn(),
    findById: jest.fn(),
    findByCode: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    countGroups: jest.fn(),
    syncRoles: jest.fn(),
  };
}

function makeMockRbacCache() {
  return { bumpVersion: jest.fn().mockResolvedValue(undefined) };
}

function makeMockI18n() {
  return {} as any;
}

function createService(overrides: Record<string, any> = {}) {
  const repo = overrides.repo ?? makeMockRepo();
  const rbacCache = overrides.rbacCache ?? makeMockRbacCache();
  const i18n = overrides.i18n ?? makeMockI18n();

  const service = new (ContextService as any)(repo, rbacCache, i18n);
  return { service, repo, rbacCache, i18n };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('ContextService', () => {
  // --- getOne ---
  describe('getOne', () => {
    it('should return the context when found', async () => {
      const { service, repo } = createService();
      const ctx = { id: BigInt(1), code: 'org', name: 'Organization' };
      repo.findById.mockResolvedValue(ctx);

      const result = await service.getOne(BigInt(1));
      expect(result).toEqual(ctx);
    });

    it('should throw NotFoundException when not found', async () => {
      const { service, repo } = createService();
      repo.findById.mockResolvedValue(null);

      await expect(service.getOne(BigInt(999))).rejects.toThrow(NotFoundException);
    });
  });

  // --- create ---
  describe('create', () => {
    it('should create context when code is unique', async () => {
      const { service, repo } = createService();
      repo.findByCode.mockResolvedValue(null);
      const created = { id: BigInt(1), code: 'new-ctx' };
      repo.create.mockResolvedValue(created);

      const result = await service.create(
        { type: 'organization', code: 'new-ctx', name: 'New' } as any,
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

    it('should include ref_id when provided', async () => {
      const { service, repo } = createService();
      repo.findByCode.mockResolvedValue(null);
      repo.create.mockResolvedValue({ id: BigInt(1) });

      await service.create(
        { type: 'org', code: 'x', name: 'X', ref_id: 'ext-123' } as any,
        BigInt(100),
      );
      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ refId: 'ext-123' }),
      );
    });
  });

  // --- update ---
  describe('update', () => {
    it('should update the context', async () => {
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

    it('should not bump cache when status is not changed', async () => {
      const { service, repo, rbacCache } = createService();
      repo.findById.mockResolvedValue({ id: BigInt(1) });
      repo.update.mockResolvedValue({ id: BigInt(1) });

      await service.update(BigInt(1), { name: 'New Name' } as any, BigInt(100));
      expect(rbacCache.bumpVersion).not.toHaveBeenCalled();
    });
  });

  // --- delete ---
  describe('delete', () => {
    it('should delete and bump cache when no groups reference it', async () => {
      const { service, repo, rbacCache } = createService();
      repo.findById.mockResolvedValue({ id: BigInt(1) });
      repo.countGroups.mockResolvedValue(0);
      repo.delete.mockResolvedValue(undefined);

      const result = await service.delete(BigInt(1));
      expect(result.message).toBe('context.DELETED');
      expect(rbacCache.bumpVersion).toHaveBeenCalled();
    });

    it('should throw ConflictException when context is in use by groups', async () => {
      const { service, repo } = createService();
      repo.findById.mockResolvedValue({ id: BigInt(1) });
      repo.countGroups.mockResolvedValue(3);

      await expect(service.delete(BigInt(1))).rejects.toThrow(ConflictException);
    });

    it('should throw NotFoundException when not found', async () => {
      const { service, repo } = createService();
      repo.findById.mockResolvedValue(null);

      await expect(service.delete(BigInt(999))).rejects.toThrow(NotFoundException);
    });
  });

  // --- syncRoles ---
  describe('syncRoles', () => {
    it('should sync roles and bump cache', async () => {
      const { service, repo, rbacCache } = createService();
      repo.findById.mockResolvedValue({ id: BigInt(1) });
      repo.syncRoles.mockResolvedValue(undefined);

      const result = await service.syncRoles(BigInt(1), { roleIds: [BigInt(10)] } as any);
      expect(repo.syncRoles).toHaveBeenCalledWith(BigInt(1), [BigInt(10)]);
      expect(rbacCache.bumpVersion).toHaveBeenCalled();
      expect(result.message).toBe('context.ROLES_SYNCED');
    });

    it('should throw NotFoundException when context not found', async () => {
      const { service, repo } = createService();
      repo.findById.mockResolvedValue(null);

      await expect(
        service.syncRoles(BigInt(999), { roleIds: [] } as any),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // --- getList ---
  describe('getList', () => {
    it('should return paginated results', async () => {
      const { service, repo } = createService();
      repo.findMany.mockResolvedValue([{ id: BigInt(1) }]);
      repo.count.mockResolvedValue(1);

      const result = await service.getList({} as any);
      expect(result.data).toHaveLength(1);
    });

    it('should skip count when skipCount is true', async () => {
      const { service, repo } = createService();
      repo.findMany.mockResolvedValue([]);

      await service.getList({ skipCount: 'true' } as any);
      expect(repo.count).not.toHaveBeenCalled();
    });
  });
});
