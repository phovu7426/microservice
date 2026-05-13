import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { parseQueryOptions, createPaginationMeta, t } from '@package/common';
import { PrimaryKey } from 'src/types';
import { assertNoCycle } from '../../../../helpers/hierarchy.helper';
import { PermissionFilter, PermissionRepository } from '../../repositories/permission.repository';
import { RbacCacheService } from '../../../../rbac/services/rbac-cache.service';
import { RbacPermissionIndexService } from '../../../../rbac/services/rbac-permission-index.service';
import { ListPermissionsAdminQueryDto } from '../dtos/list-permission.query.dto';
import { CreatePermissionDto } from '../dtos/create-permission.dto';
import { UpdatePermissionDto } from '../dtos/update-permission.dto';
import { PermissionScope } from '../../enums/permission-scope.enum';

@Injectable()
export class PermissionService {
  constructor(
    private readonly repo: PermissionRepository,
    private readonly rbacCache: RbacCacheService,
    private readonly permIndex: RbacPermissionIndexService,
    private readonly i18n: I18nService,
  ) {}

  async getList(query: ListPermissionsAdminQueryDto) {
    const options = parseQueryOptions(query);
    const filter: PermissionFilter = {};
    if (query.status) filter.status = query.status;
    if (query.scope) filter.scope = query.scope;
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
      throw new NotFoundException(t(this.i18n, 'permission.NOT_FOUND'));
    }
    return item;
  }

  async create(dto: CreatePermissionDto, actorId: PrimaryKey) {
    const existing = await this.repo.findByCode(dto.code);
    if (existing) {
      throw new ConflictException(t(this.i18n, 'permission.CODE_EXISTS'));
    }
    const data: any = {
      code: dto.code,
      name: dto.name,
      scope: dto.scope ?? PermissionScope.context,
      createdUserId: actorId,
    };
    if (dto.parentId) data.parent = { connect: { id: dto.parentId } };
    const result = await this.repo.create(data);
    await this.rbacCache.bumpVersion();
    await this.permIndex.publishRefresh();
    return result;
  }

  async update(id: PrimaryKey, dto: UpdatePermissionDto, actorId: PrimaryKey) {
    await this.getOne(id);
    if (dto.parentId) {
      await assertNoCycle(
        id,
        dto.parentId,
        (cur) => this.repo.getParentId(cur),
        t(this.i18n, 'permission.CYCLE_DETECTED'),
      );
    }
    const data: any = { updatedUserId: actorId };
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.status !== undefined) data.status = dto.status;
    if ('parentId' in dto) {
      data.parent = dto.parentId
        ? { connect: { id: dto.parentId } }
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
    await this.permIndex.publishRefresh();
    return { message: t(this.i18n, 'permission.DELETED') };
  }

}
