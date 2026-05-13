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

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { RbacRoleAssignmentService } from '../../../src/rbac/services/rbac-role-assignment.service';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeMockRbacRepo() {
  return {
    assignRoleToUser: jest.fn(),
    findActiveGroup: jest.fn(),
    syncRolesInGroup: jest.fn(),
    getActivePermissionCodes: jest.fn(),
  };
}

function makeMockI18n() {
  return {} as any;
}

function createService(overrides: Record<string, any> = {}) {
  const rbacRepo = overrides.rbacRepo ?? makeMockRbacRepo();
  const i18n = overrides.i18n ?? makeMockI18n();
  const service = new (RbacRoleAssignmentService as any)(rbacRepo, i18n);
  return { service, rbacRepo, i18n };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('RbacRoleAssignmentService', () => {
  // --- assignRoleToUser ---
  describe('assignRoleToUser', () => {
    it('should delegate to rbacRepo', async () => {
      const { service, rbacRepo } = createService();
      rbacRepo.assignRoleToUser.mockResolvedValue(undefined);

      await service.assignRoleToUser('u1', 'r1', 'g1');
      expect(rbacRepo.assignRoleToUser).toHaveBeenCalledWith('u1', 'r1', 'g1');
    });
  });

  // --- syncRolesInGroup ---
  describe('syncRolesInGroup', () => {
    it('should throw NotFoundException when group not found', async () => {
      const { service, rbacRepo } = createService();
      rbacRepo.findActiveGroup.mockResolvedValue(null);

      await expect(
        service.syncRolesInGroup('u1', 'g1', ['r1']),
      ).rejects.toThrow(NotFoundException);
    });

    it('should sync roles when group exists', async () => {
      const { service, rbacRepo } = createService();
      rbacRepo.findActiveGroup.mockResolvedValue({ id: BigInt(1), contextId: BigInt(10) });
      rbacRepo.syncRolesInGroup.mockResolvedValue({ before: [], after: [BigInt(1)] });

      const result = await service.syncRolesInGroup('u1', 'g1', ['r1']);
      expect(result).toEqual({ before: [], after: [BigInt(1)] });
      expect(rbacRepo.syncRolesInGroup).toHaveBeenCalledWith(
        'u1', 'g1', ['r1'], BigInt(10), false,
      );
    });

    it('should throw BadRequestException when invalid roles detected', async () => {
      const { service, rbacRepo } = createService();
      rbacRepo.findActiveGroup.mockResolvedValue({ id: BigInt(1), contextId: BigInt(10) });
      rbacRepo.syncRolesInGroup.mockResolvedValue({
        before: [],
        after: [],
        invalidRoleIds: [BigInt(99)],
      });

      await expect(
        service.syncRolesInGroup('u1', 'g1', ['r99']),
      ).rejects.toThrow(BadRequestException);
    });

    it('should pass skipValidation flag through', async () => {
      const { service, rbacRepo } = createService();
      rbacRepo.findActiveGroup.mockResolvedValue({ id: BigInt(1), contextId: BigInt(10) });
      rbacRepo.syncRolesInGroup.mockResolvedValue({ before: [], after: [] });

      await service.syncRolesInGroup('u1', 'g1', ['r1'], true);
      expect(rbacRepo.syncRolesInGroup).toHaveBeenCalledWith(
        'u1', 'g1', ['r1'], BigInt(10), true,
      );
    });
  });

  // --- getActivePermissionCodes ---
  describe('getActivePermissionCodes', () => {
    it('should return codes from repo', async () => {
      const { service, rbacRepo } = createService();
      rbacRepo.getActivePermissionCodes.mockResolvedValue(['perm.a', 'perm.b']);

      const result = await service.getActivePermissionCodes('u1', null);
      expect(result).toEqual(['perm.a', 'perm.b']);
      expect(rbacRepo.getActivePermissionCodes).toHaveBeenCalledWith('u1', null);
    });

    it('should pass groupId when provided', async () => {
      const { service, rbacRepo } = createService();
      rbacRepo.getActivePermissionCodes.mockResolvedValue(['perm.c']);

      await service.getActivePermissionCodes('u1', 'g5');
      expect(rbacRepo.getActivePermissionCodes).toHaveBeenCalledWith('u1', 'g5');
    });
  });
});
