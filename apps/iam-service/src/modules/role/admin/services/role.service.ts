import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { parseQueryOptions, createPaginationMeta, t } from '@package/common';
import { PrimaryKey } from 'src/types';
import { assertNoCycle } from '../../../../helpers/hierarchy.helper';
import { RoleFilter, RoleRepository } from '../../repositories/role.repository';
import { RbacCacheService } from '../../../../rbac/services/rbac-cache.service';
import { RbacPermissionIndexService } from '../../../../rbac/services/rbac-permission-index.service';
import { RbacService } from '../../../../rbac/services/rbac.service';
import { ListRolesAdminQueryDto } from '../dtos/list-role.query.dto';
import { CreateRoleDto } from '../dtos/create-role.dto';
import { UpdateRoleDto } from '../dtos/update-role.dto';
import { SyncPermissionsDto } from '../dtos/sync-permissions.dto';

@Injectable()
export class RoleService {
  constructor(
    private readonly repo: RoleRepository,
    private readonly rbacCache: RbacCacheService,
    private readonly permIndex: RbacPermissionIndexService,
    private readonly rbacService: RbacService,
    private readonly i18n: I18nService,
  ) {}

  async getList(query: ListRolesAdminQueryDto) {
    const options = parseQueryOptions(query);
    const filter: RoleFilter = {};
    if (query.status) filter.status = query.status;
    if (query.search) filter.search = query.search;

    const skipCount = query.skipCount === 'true';
    const [data, total] = await Promise.all([
      this.repo.findMany(filter, options),
      skipCount ? Promise.resolve(0) : this.repo.count(filter),
    ]);
    return { data, meta: createPaginationMeta(options, total) };
  }

  async getOne(id: PrimaryKey) {
    const item = await this.repo.findById(id);
    if (!item) {
      throw new NotFoundException(t(this.i18n, 'role.NOT_FOUND'));
    }
    return item;
  }

  async create(dto: CreateRoleDto, actorId: PrimaryKey) {
    const existing = await this.repo.findByCode(dto.code);
    if (existing) {
      throw new ConflictException(t(this.i18n, 'role.CODE_EXISTS'));
    }
    const data: any = { code: dto.code, name: dto.name, created_user_id: actorId };
    if (dto.parent_id) {
      // Check the parent exists; cycle check is N/A on create (no children yet).
      data.parent = { connect: { id: dto.parent_id } };
    }
    return this.repo.create(data);
  }

  async update(id: PrimaryKey, dto: UpdateRoleDto, actorId: PrimaryKey) {
    await this.getOne(id);
    if (dto.parent_id) {
      await assertNoCycle(
        id,
        dto.parent_id,
        (cur) => this.repo.getParentId(cur),
        t(this.i18n, 'role.CYCLE_DETECTED'),
      );
    }
    const data: any = { updated_user_id: actorId };
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.status !== undefined) data.status = dto.status;
    if ('parent_id' in dto) {
      data.parent = dto.parent_id
        ? { connect: { id: dto.parent_id } }
        : { disconnect: true };
    }
    const result = await this.repo.update(id, data);
    await this.rbacCache.bumpVersion();
    await this.permIndex.publishRefresh();
    return result;
  }

  async delete(id: PrimaryKey) {
    await this.getOne(id);
    await this.repo.delete(id);
    await this.rbacCache.bumpVersion();
    return { message: t(this.i18n, 'role.DELETED') };
  }

  async syncPermissions(
    id: PrimaryKey,
    dto: SyncPermissionsDto,
    actor: { id: string; groupId?: string | null },
  ) {
    await this.getOne(id);
    const targetIds = dto.permissionIds;
    // Caller must already hold every permission they want to wire onto this role.
    if (targetIds.length) {
      const targetCodes = await this.repo.getPermissionCodesByIds(targetIds);
      if (targetCodes.length) {
        await this.rbacService.assertCallerCanGrantPermissionCodes(
          actor.id,
          actor.groupId ?? null,
          targetCodes,
        );
      }
    }
    await this.repo.syncPermissions(id, targetIds);
    await this.rbacCache.bumpVersion();
    await this.permIndex.publishRefresh();
    return { message: t(this.i18n, 'role.PERMISSIONS_SYNCED') };
  }

}
