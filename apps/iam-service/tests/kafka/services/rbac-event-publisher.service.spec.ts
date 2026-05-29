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

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------
import { RbacEventPublisher } from '../../../src/event/services/rbac-event-publisher.service';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeMockPrisma() {
  return {
    outbox: {
      create: jest.fn().mockResolvedValue({ id: 1 }),
    },
  } as any;
}

function createService() {
  const prisma = makeMockPrisma();
  const service = new (RbacEventPublisher as any)(prisma);
  return { service, prisma };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('RbacEventPublisher', () => {
  describe('publishRoleChanged', () => {
    it('should insert an outbox event with event_type role.changed', async () => {
      const { service, prisma } = createService();

      await service.publishRoleChanged({
        roleId: BigInt(1),
        action: 'created',
        roleCode: 'admin',
        userId: BigInt(100),
      });

      expect(prisma.outbox.create).toHaveBeenCalledWith({
        data: {
          eventType: 'role.changed',
          payload: expect.objectContaining({
            role_id: '1',
            action: 'created',
            role_code: 'admin',
            user_id: '100',
          }),
        },
      });
    });

    it('should omit user_id when not provided', async () => {
      const { service, prisma } = createService();

      await service.publishRoleChanged({
        roleId: BigInt(1),
        action: 'deleted',
        roleCode: 'editor',
      });

      expect(prisma.outbox.create).toHaveBeenCalledWith({
        data: {
          eventType: 'role.changed',
          payload: expect.objectContaining({
            role_id: '1',
            action: 'deleted',
            user_id: undefined,
          }),
        },
      });
    });
  });

  describe('publishPermissionChanged', () => {
    it('should insert an outbox event with event_type permission.changed', async () => {
      const { service, prisma } = createService();

      await service.publishPermissionChanged({
        permissionId: BigInt(5),
        action: 'updated',
        permissionCode: 'role.view',
      });

      expect(prisma.outbox.create).toHaveBeenCalledWith({
        data: {
          eventType: 'permission.changed',
          payload: expect.objectContaining({
            permission_id: '5',
            action: 'updated',
            permission_code: 'role.view',
          }),
        },
      });
    });
  });

  describe('publishRolePermissionChanged', () => {
    it('should insert an outbox event with event_type role.permission.changed', async () => {
      const { service, prisma } = createService();

      await service.publishRolePermissionChanged({
        roleId: BigInt(1),
        permissionIds: [BigInt(10), BigInt(20)],
        action: 'attached',
      });

      expect(prisma.outbox.create).toHaveBeenCalledWith({
        data: {
          eventType: 'role.permission.changed',
          payload: expect.objectContaining({
            role_id: '1',
            permission_ids: ['10', '20'],
            action: 'attached',
          }),
        },
      });
    });
  });

  describe('publishUserRoleAssigned', () => {
    it('should insert an outbox event with event_type user.role.assigned', async () => {
      const { service, prisma } = createService();

      await service.publishUserRoleAssigned({
        userId: BigInt(1),
        roleId: BigInt(2),
        groupId: BigInt(3),
      });

      expect(prisma.outbox.create).toHaveBeenCalledWith({
        data: {
          eventType: 'user.role.assigned',
          payload: {
            user_id: '1',
            role_id: '2',
            group_id: '3',
          },
        },
      });
    });
  });

  describe('publishUserRoleRevoked', () => {
    it('should insert an outbox event with event_type user.role.revoked', async () => {
      const { service, prisma } = createService();

      await service.publishUserRoleRevoked({
        userId: BigInt(1),
        roleId: BigInt(2),
        groupId: BigInt(3),
      });

      expect(prisma.outbox.create).toHaveBeenCalledWith({
        data: {
          eventType: 'user.role.revoked',
          payload: {
            user_id: '1',
            role_id: '2',
            group_id: '3',
          },
        },
      });
    });
  });

  describe('publishCacheInvalidation', () => {
    it('should insert an outbox event with event_type rbac.cache.invalidate', async () => {
      const { service, prisma } = createService();

      await service.publishCacheInvalidation({
        pattern: '*',
        reason: 'role updated',
        affectedUserIds: [BigInt(10), BigInt(20)],
      });

      expect(prisma.outbox.create).toHaveBeenCalledWith({
        data: {
          eventType: 'rbac.cache.invalidate',
          payload: {
            pattern: '*',
            reason: 'role updated',
            affected_user_ids: ['10', '20'],
          },
        },
      });
    });

    it('should handle missing affectedUserIds', async () => {
      const { service, prisma } = createService();

      await service.publishCacheInvalidation({
        pattern: 'user:*',
        reason: 'bulk update',
      });

      expect(prisma.outbox.create).toHaveBeenCalledWith({
        data: {
          eventType: 'rbac.cache.invalidate',
          payload: {
            pattern: 'user:*',
            reason: 'bulk update',
            affected_user_ids: undefined,
          },
        },
      });
    });
  });

  describe('error handling', () => {
    it('should re-throw when prisma.outbox.create fails', async () => {
      const { service, prisma } = createService();
      prisma.outbox.create.mockRejectedValue(new Error('DB connection lost'));

      await expect(
        service.publishRoleChanged({
          roleId: BigInt(1),
          action: 'created',
          roleCode: 'admin',
        }),
      ).rejects.toThrow('DB connection lost');
    });
  });
});
