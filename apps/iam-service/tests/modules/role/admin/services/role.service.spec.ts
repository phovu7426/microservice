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

jest.mock('../../../../../src/modules/role/repositories/role.repository', () => ({
  RoleRepository: jest.fn(),
}));

jest.mock('../../../../../src/rbac/repositories/rbac.repository', () => ({
  RbacRepository: jest.fn(),
}));

jest.mock('../../../../../src/rbac/services/rbac-cache.service', () => ({
  RbacCacheService: jest.fn(),
}));

jest.mock('../../../../../src/rbac/services/rbac-permission-index.service', () => ({
  RbacPermissionIndexService: jest.fn(),
}));

jest.mock('../../../../../src/rbac/services/rbac.service', () => ({
  RbacService: jest.fn(),
}));

jest.mock('../../../../../src/rbac/services/rbac-role-assignment.service', () => ({
  RbacRoleAssignmentService: jest.fn(),
}));

jest.mock('@package/redis', () => ({
  RedisService: jest.fn(),
}));

jest.mock('../../../../../src/helpers/hierarchy.helper', () => ({
  assertNoCycle: jest.fn(),
}));

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------
import { ConflictException, NotFoundException } from '@nestjs/common';
import { RoleService } from '../../../../../src/modules/role/admin/services/role.service';
import { assertNoCycle } from '../../../../../src/helpers/hierarchy.helper';

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
    getParentId: jest.fn(),
    syncPermissions: jest.fn(),
    getPermissionCodesByIds: jest.fn(),
  };
}

function makeMockRbacCache() {
  return { bumpVersion: jest.fn().mockResolvedValue(undefined) };
}

function makeMockPermIndex() {
  return { publishRefresh: jest.fn().mockResolvedValue(undefined) };
}

function makeMockRbacService() {
  return { assertCallerCanGrantPermissionCodes: jest.fn().mockResolvedValue(undefined) };
}

function makeMockI18n() {
  return {} as any;
}

function createService(overrides: Record<string, any> = {}) {
  const repo = overrides.repo ?? makeMockRepo();
  const rbacCache = overrides.rbacCache ?? makeMockRbacCache();
  const permIndex = overrides.permIndex ?? makeMockPermIndex();
  const rbacService = overrides.rbacService ?? makeMockRbacService();
  const i18n = overrides.i18n ?? makeMockI18n();

  const service = new (RoleService as any)(repo, rbacCache, permIndex, rbacService, i18n);
  return { service, repo, rbacCache, permIndex, rbacService, i18n };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('RoleService', () => {
  // --- getOne ---
  describe('getOne', () => {
    it('should return the role when found', async () => {
      const { service, repo } = createService();
      const role = { id: BigInt(1), code: 'admin', name: 'Admin' };
      repo.findById.mockResolvedValue(role);

      const result = await service.getOne(BigInt(1));
      expect(result).toEqual(role);
    });

    it('should throw NotFoundException when role not found', async () => {
      const { service, repo } = createService();
      repo.findById.mockResolvedValue(null);

      await expect(service.getOne(BigInt(999))).rejects.toThrow(NotFoundException);
    });
  });

  // --- create ---
  describe('create', () => {
    it('should create a role when code is unique', async () => {
      const { service, repo } = createService();
      repo.findByCode.mockResolvedValue(null);
      const created = { id: BigInt(1), code: 'editor', name: 'Editor' };
      repo.create.mockResolvedValue(created);

      const result = await service.create(
        { code: 'editor', name: 'Editor' } as any,
        BigInt(100),
      );
      expect(result).toEqual(created);
      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'editor', name: 'Editor', createdUserId: BigInt(100) }),
      );
    });

    it('should throw ConflictException when code already exists', async () => {
      const { service, repo } = createService();
      repo.findByCode.mockResolvedValue({ id: BigInt(1) });

      await expect(
        service.create({ code: 'admin', name: 'Admin' } as any, BigInt(100)),
      ).rejects.toThrow(ConflictException);
    });

    it('should connect parent when parent_id is provided', async () => {
      const { service, repo } = createService();
      repo.findByCode.mockResolvedValue(null);
      repo.create.mockResolvedValue({ id: BigInt(2) });

      await service.create(
        { code: 'sub-admin', name: 'Sub Admin', parent_id: BigInt(1) } as any,
        BigInt(100),
      );
      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ parent: { connect: { id: BigInt(1) } } }),
      );
    });
  });

  // --- update ---
  describe('update', () => {
    it('should update the role and bump cache/index', async () => {
      const { service, repo, rbacCache, permIndex } = createService();
      repo.findById.mockResolvedValue({ id: BigInt(1) });
      repo.update.mockResolvedValue({ id: BigInt(1), name: 'Updated' });

      const result = await service.update(BigInt(1), { name: 'Updated' } as any, BigInt(100));
      expect(result.name).toBe('Updated');
      expect(rbacCache.bumpVersion).toHaveBeenCalled();
      expect(permIndex.publishRefresh).toHaveBeenCalled();
    });

    it('should check for cycles when parent_id is provided', async () => {
      const { service, repo } = createService();
      repo.findById.mockResolvedValue({ id: BigInt(1) });
      repo.update.mockResolvedValue({ id: BigInt(1) });

      await service.update(BigInt(1), { parent_id: BigInt(2) } as any, BigInt(100));
      expect(assertNoCycle).toHaveBeenCalledWith(
        BigInt(1),
        BigInt(2),
        expect.any(Function),
        'role.CYCLE_DETECTED',
      );
    });

    it('should disconnect parent when parent_id is explicitly null', async () => {
      const { service, repo } = createService();
      repo.findById.mockResolvedValue({ id: BigInt(1) });
      repo.update.mockResolvedValue({ id: BigInt(1) });

      await service.update(BigInt(1), { parent_id: null } as any, BigInt(100));
      expect(repo.update).toHaveBeenCalledWith(
        BigInt(1),
        expect.objectContaining({ parent: { disconnect: true } }),
      );
    });
  });

  // --- delete ---
  describe('delete', () => {
    it('should delete the role and bump cache', async () => {
      const { service, repo, rbacCache } = createService();
      repo.findById.mockResolvedValue({ id: BigInt(1) });
      repo.delete.mockResolvedValue(undefined);

      const result = await service.delete(BigInt(1));
      expect(result.message).toBe('role.DELETED');
      expect(rbacCache.bumpVersion).toHaveBeenCalled();
    });

    it('should throw NotFoundException when role not found', async () => {
      const { service, repo } = createService();
      repo.findById.mockResolvedValue(null);

      await expect(service.delete(BigInt(999))).rejects.toThrow(NotFoundException);
    });
  });

  // --- syncPermissions ---
  describe('syncPermissions', () => {
    it('should sync permissions and bump cache/index', async () => {
      const { service, repo, rbacCache, permIndex, rbacService } = createService();
      repo.findById.mockResolvedValue({ id: BigInt(1) });
      repo.getPermissionCodesByIds.mockResolvedValue(['role.view', 'role.create']);
      repo.syncPermissions.mockResolvedValue(undefined);

      const result = await service.syncPermissions(
        BigInt(1),
        { permissionIds: [BigInt(10), BigInt(11)] } as any,
        { id: 'actor1', groupId: null },
      );

      expect(rbacService.assertCallerCanGrantPermissionCodes).toHaveBeenCalledWith(
        'actor1', null, ['role.view', 'role.create'],
      );
      expect(repo.syncPermissions).toHaveBeenCalledWith(BigInt(1), [BigInt(10), BigInt(11)]);
      expect(rbacCache.bumpVersion).toHaveBeenCalled();
      expect(permIndex.publishRefresh).toHaveBeenCalled();
      expect(result.message).toBe('role.PERMISSIONS_SYNCED');
    });

    it('should skip privilege check when permissionIds is empty', async () => {
      const { service, repo, rbacService } = createService();
      repo.findById.mockResolvedValue({ id: BigInt(1) });
      repo.syncPermissions.mockResolvedValue(undefined);

      await service.syncPermissions(
        BigInt(1),
        { permissionIds: [] } as any,
        { id: 'actor1', groupId: null },
      );

      expect(rbacService.assertCallerCanGrantPermissionCodes).not.toHaveBeenCalled();
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
      expect(result.meta).toBeDefined();
    });

    it('should skip count when skipCount is true', async () => {
      const { service, repo } = createService();
      repo.findMany.mockResolvedValue([]);

      const result = await service.getList({ skipCount: 'true' } as any);
      expect(repo.count).not.toHaveBeenCalled();
      expect(result.meta).toBeDefined();
    });
  });
});
