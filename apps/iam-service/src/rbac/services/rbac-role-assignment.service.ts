import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { t } from '@package/common';
import { RbacRepository } from '../repositories/rbac.repository';
import { RbacId } from '../types';

@Injectable()
export class RbacRoleAssignmentService {
  constructor(
    private readonly rbacRepo: RbacRepository,
    private readonly i18n: I18nService,
  ) {}

  async assignRoleToUser(userId: RbacId, roleId: RbacId, groupId: RbacId): Promise<void> {
    await this.rbacRepo.assignRoleToUser(userId, roleId, groupId);
  }

  async syncRolesInGroup(
    userId: RbacId,
    groupId: RbacId,
    roleIds: RbacId[],
    skipValidation = false,
  ): Promise<{ before: bigint[]; after: bigint[] }> {
    const group = await this.rbacRepo.findActiveGroup(groupId);
    if (!group) {
      throw new NotFoundException(t(this.i18n, 'rbac.GROUP_NOT_FOUND'));
    }

    const result = await this.rbacRepo.syncRolesInGroup(
      userId, groupId, roleIds, group.contextId, skipValidation,
    );

    // Check if repo flagged invalid roles
    if ((result as any).invalidRoleIds?.length) {
      const id = (result as any).invalidRoleIds[0];
      throw new BadRequestException(
        t(this.i18n, 'rbac.ROLE_NOT_ALLOWED_IN_CONTEXT', { id }),
      );
    }

    return result;
  }

  async getActivePermissionCodes(userId: RbacId, groupId: RbacId | null): Promise<string[]> {
    return this.rbacRepo.getActivePermissionCodes(userId, groupId);
  }
}
