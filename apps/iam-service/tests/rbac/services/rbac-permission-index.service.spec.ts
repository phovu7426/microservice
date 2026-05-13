// ---------------------------------------------------------------------------
// Module mocks -- must come before any import
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

jest.mock('src/generated/prisma', () => ({
  PrismaClient: jest.fn(),
  Prisma: {},
}), { virtual: true });

jest.mock('@prisma/adapter-pg', () => ({
  PrismaPg: jest.fn(),
}));

jest.mock('../../../src/core/database/prisma.service', () => ({
  PrismaService: jest.fn(),
}));

jest.mock('../../../src/rbac/repositories/rbac.repository', () => ({
  RbacRepository: jest.fn(),
}));

jest.mock('@package/redis', () => ({
  RedisService: jest.fn(),
}));

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------
import { RbacPermissionIndexService } from '../../../src/rbac/services/rbac-permission-index.service';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeMockRbacRepo() {
  return {
    findPermissions: jest.fn(),
  };
}

function makeMockRedis() {
  return {
    isEnabled: jest.fn().mockReturnValue(false),
    subscribe: jest.fn(),
    unsubscribe: jest.fn(),
    publish: jest.fn(),
  };
}

function createService(overrides: Record<string, any> = {}) {
  const rbacRepo = overrides.rbacRepo ?? makeMockRbacRepo();
  const redis = overrides.redis ?? makeMockRedis();
  const service = new (RbacPermissionIndexService as any)(rbacRepo, redis);
  return { service, rbacRepo, redis };
}

// Sample permission tree:
//   system.manage (root)
//   role (root) -> role.view (child of role)
//   comic (root) -> comic.manage (child) -> comic.view (grandchild)
function samplePermissions() {
  return [
    { id: BigInt(1), code: 'system.manage', parentId: null },
    { id: BigInt(2), code: 'role', parentId: null },
    { id: BigInt(3), code: 'role.view', parentId: BigInt(2) },
    { id: BigInt(4), code: 'comic', parentId: null },
    { id: BigInt(5), code: 'comic.manage', parentId: BigInt(4) },
    { id: BigInt(6), code: 'comic.view', parentId: BigInt(5) },
  ];
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('RbacPermissionIndexService', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  // --- matchesAssigned ---
  describe('matchesAssigned', () => {
    it('should return true when user directly has the needed code', async () => {
      const { service, rbacRepo } = createService();
      rbacRepo.findPermissions.mockResolvedValue(samplePermissions());
      await service.prepare();

      const assigned = new Set(['role.view']);
      expect(service.matchesAssigned(assigned, 'role.view')).toBe(true);
    });

    it('should return true when user has system.manage (superadmin)', async () => {
      const { service, rbacRepo } = createService();
      rbacRepo.findPermissions.mockResolvedValue(samplePermissions());
      await service.prepare();

      const assigned = new Set(['system.manage']);
      expect(service.matchesAssigned(assigned, 'comic.view')).toBe(true);
    });

    it('should return true when user has parent permission (hierarchy grant)', async () => {
      const { service, rbacRepo } = createService();
      rbacRepo.findPermissions.mockResolvedValue(samplePermissions());
      await service.prepare();

      // User has 'comic.manage', which is parent of 'comic.view'
      const assigned = new Set(['comic.manage']);
      expect(service.matchesAssigned(assigned, 'comic.view')).toBe(true);
    });

    it('should return true for grandparent permissions', async () => {
      const { service, rbacRepo } = createService();
      rbacRepo.findPermissions.mockResolvedValue(samplePermissions());
      await service.prepare();

      // 'comic' is grandparent of 'comic.view'
      const assigned = new Set(['comic']);
      expect(service.matchesAssigned(assigned, 'comic.view')).toBe(true);
    });

    it('should return false when user lacks the permission and its ancestors', async () => {
      const { service, rbacRepo } = createService();
      rbacRepo.findPermissions.mockResolvedValue(samplePermissions());
      await service.prepare();

      const assigned = new Set(['role.view']);
      expect(service.matchesAssigned(assigned, 'comic.view')).toBe(false);
    });

    it('should return false for empty assigned set (no system.manage)', async () => {
      const { service, rbacRepo } = createService();
      rbacRepo.findPermissions.mockResolvedValue(samplePermissions());
      await service.prepare();

      const assigned = new Set<string>();
      expect(service.matchesAssigned(assigned, 'role.view')).toBe(false);
    });
  });

  // --- hasAnyRequiredFromAssigned ---
  describe('hasAnyRequiredFromAssigned', () => {
    it('should return true if any required permission matches', async () => {
      const { service, rbacRepo } = createService();
      rbacRepo.findPermissions.mockResolvedValue(samplePermissions());
      await service.prepare();

      const assigned = new Set(['role.view']);
      expect(service.hasAnyRequiredFromAssigned(assigned, ['comic.view', 'role.view'])).toBe(true);
    });

    it('should return false if no required permission matches', async () => {
      const { service, rbacRepo } = createService();
      rbacRepo.findPermissions.mockResolvedValue(samplePermissions());
      await service.prepare();

      const assigned = new Set(['role.view']);
      expect(service.hasAnyRequiredFromAssigned(assigned, ['comic.view', 'comic.manage'])).toBe(false);
    });
  });

  // --- prepare / ensurePermissionIndexes ---
  describe('prepare', () => {
    it('should load permissions from repo on first call', async () => {
      const { service, rbacRepo } = createService();
      rbacRepo.findPermissions.mockResolvedValue(samplePermissions());

      await service.prepare();
      expect(rbacRepo.findPermissions).toHaveBeenCalledTimes(1);
    });

    it('should not reload if already loaded and not expired', async () => {
      const { service, rbacRepo } = createService();
      rbacRepo.findPermissions.mockResolvedValue(samplePermissions());

      await service.prepare();
      await service.prepare();
      expect(rbacRepo.findPermissions).toHaveBeenCalledTimes(1);
    });

    it('should coalesce concurrent prepare calls (single-flight)', async () => {
      const { service, rbacRepo } = createService();
      let resolveFind!: (v: any) => void;
      rbacRepo.findPermissions.mockReturnValue(
        new Promise((r) => { resolveFind = r; }),
      );

      const p1 = service.prepare();
      const p2 = service.prepare();

      resolveFind(samplePermissions());
      await Promise.all([p1, p2]);

      expect(rbacRepo.findPermissions).toHaveBeenCalledTimes(1);
    });
  });

  // --- refreshNow ---
  describe('refreshNow', () => {
    it('should force reload even if not expired', async () => {
      const { service, rbacRepo } = createService();
      rbacRepo.findPermissions.mockResolvedValue(samplePermissions());

      await service.prepare();
      await service.refreshNow();
      expect(rbacRepo.findPermissions).toHaveBeenCalledTimes(2);
    });
  });

  // --- publishRefresh ---
  describe('publishRefresh', () => {
    it('should refresh and publish when redis enabled', async () => {
      const redis = makeMockRedis();
      redis.isEnabled.mockReturnValue(true);
      redis.publish.mockResolvedValue(undefined);
      const { service, rbacRepo } = createService({ redis });
      rbacRepo.findPermissions.mockResolvedValue(samplePermissions());

      await service.publishRefresh();

      expect(rbacRepo.findPermissions).toHaveBeenCalled();
      expect(redis.publish).toHaveBeenCalledWith(
        'rbac:perm_index_refresh',
        expect.any(String),
      );
    });

    it('should refresh without publishing when redis disabled', async () => {
      const { service, rbacRepo, redis } = createService();
      rbacRepo.findPermissions.mockResolvedValue(samplePermissions());
      redis.isEnabled.mockReturnValue(false);

      await service.publishRefresh();
      expect(rbacRepo.findPermissions).toHaveBeenCalled();
      expect(redis.publish).not.toHaveBeenCalled();
    });
  });

  // --- onModuleInit / onModuleDestroy lifecycle ---
  describe('lifecycle', () => {
    it('onModuleInit should load index and set up prewarm timer', async () => {
      const { service, rbacRepo } = createService();
      rbacRepo.findPermissions.mockResolvedValue(samplePermissions());

      await service.onModuleInit();
      expect(rbacRepo.findPermissions).toHaveBeenCalled();
    });

    it('onModuleDestroy should clear prewarm timer', async () => {
      const { service, rbacRepo } = createService();
      rbacRepo.findPermissions.mockResolvedValue(samplePermissions());

      await service.onModuleInit();
      await service.onModuleDestroy();
      // No error thrown means cleanup succeeded
    });

    it('onModuleDestroy should unsubscribe when redis was subscribed', async () => {
      const redis = makeMockRedis();
      redis.isEnabled.mockReturnValue(true);
      redis.subscribe.mockResolvedValue(undefined);
      redis.unsubscribe.mockResolvedValue(undefined);
      const { service, rbacRepo } = createService({ redis });
      rbacRepo.findPermissions.mockResolvedValue(samplePermissions());

      await service.onModuleInit();
      await service.onModuleDestroy();

      expect(redis.unsubscribe).toHaveBeenCalledWith(
        'rbac:perm_index_refresh',
        expect.any(Function),
      );
    });
  });
});
