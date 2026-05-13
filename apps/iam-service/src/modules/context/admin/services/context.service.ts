import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { parseQueryOptions, createPaginationMeta, t } from '@package/common';
import { PrimaryKey } from 'src/types';
import { ContextRepository, ContextFilter } from '../../repositories/context.repository';
import { RbacCacheService } from '../../../../rbac/services/rbac-cache.service';
import { ListContextsAdminQueryDto } from '../dtos/list-context.query.dto';
import { CreateContextDto } from '../dtos/create-context.dto';
import { UpdateContextDto } from '../dtos/update-context.dto';
import { SyncRolesDto } from '../dtos/sync-roles.dto';

@Injectable()
export class ContextService {
  constructor(
    private readonly repo: ContextRepository,
    private readonly rbacCache: RbacCacheService,
    private readonly i18n: I18nService,
  ) {}

  async getList(query: ListContextsAdminQueryDto) {
    const options = parseQueryOptions(query);
    const filter: ContextFilter = {};
    if (query.search) filter.search = query.search;
    if (query.type) filter.type = query.type;
    if (query.status) filter.status = query.status;

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
      throw new NotFoundException(t(this.i18n, 'context.NOT_FOUND'));
    }
    return item;
  }

  async create(dto: CreateContextDto, actorId: PrimaryKey) {
    const existing = await this.repo.findByCode(dto.code);
    if (existing) {
      throw new ConflictException(t(this.i18n, 'context.CODE_EXISTS'));
    }
    const data: any = {
      type: dto.type,
      code: dto.code,
      name: dto.name,
      createdUserId: actorId,
    };
    if (dto.refId) data.refId = dto.refId;
    return this.repo.create(data);
  }

  async update(id: PrimaryKey, dto: UpdateContextDto, actorId: PrimaryKey) {
    await this.getOne(id);
    const data: any = { updatedUserId: actorId };
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.status !== undefined) data.status = dto.status;
    const result = await this.repo.update(id, data);
    if (dto.status !== undefined) {
      await this.rbacCache.bumpVersion();
    }
    return result;
  }

  async delete(id: PrimaryKey) {
    await this.getOne(id);
    const groupCount = await this.repo.countGroups(id);
    if (groupCount > 0) {
      throw new ConflictException(t(this.i18n, 'context.IN_USE_BY_GROUPS'));
    }
    await this.repo.delete(id);
    await this.rbacCache.bumpVersion();
    return { message: t(this.i18n, 'context.DELETED') };
  }

  async syncRoles(id: PrimaryKey, dto: SyncRolesDto) {
    await this.getOne(id);
    await this.repo.syncRoles(id, dto.roleIds);
    await this.rbacCache.bumpVersion();
    return { message: t(this.i18n, 'context.ROLES_SYNCED') };
  }
}
