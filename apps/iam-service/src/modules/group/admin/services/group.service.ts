import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { parseQueryOptions, createPaginationMeta, t } from '@package/common';
import { PrimaryKey } from 'src/types';
import { GroupFilter, GroupRepository } from '../../repositories/group.repository';
import { RbacCacheService } from '../../../../rbac/services/rbac-cache.service';
import { ListGroupsAdminQueryDto } from '../dtos/list-group.query.dto';
import { CreateGroupDto } from '../dtos/create-group.dto';
import { UpdateGroupDto } from '../dtos/update-group.dto';
import { AddMemberDto } from '../dtos/add-member.dto';

@Injectable()
export class GroupService {
  constructor(
    private readonly repo: GroupRepository,
    private readonly rbacCache: RbacCacheService,
    private readonly i18n: I18nService,
  ) {}

  async getList(query: ListGroupsAdminQueryDto) {
    const options = parseQueryOptions(query);
    const filter: GroupFilter = {};
    if (query.type) filter.type = query.type;
    if (query.status) filter.status = query.status;
    if (query.context_id) filter.context_id = query.context_id;
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
      throw new NotFoundException(t(this.i18n, 'group.NOT_FOUND'));
    }
    return item;
  }

  async create(dto: CreateGroupDto, actorId: PrimaryKey) {
    const existing = await this.repo.findByCode(dto.code);
    if (existing) {
      throw new ConflictException(t(this.i18n, 'group.CODE_EXISTS'));
    }
    const data: any = {
      type: dto.type,
      code: dto.code,
      name: dto.name,
      description: dto.description,
      context_id: dto.context_id,
      created_user_id: actorId,
    };
    if (dto.owner_id) data.owner_id = dto.owner_id;
    return this.repo.create(data);
  }

  async update(id: PrimaryKey, dto: UpdateGroupDto, actorId: PrimaryKey) {
    await this.getOne(id);
    const data: any = { updated_user_id: actorId };
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.status !== undefined) data.status = dto.status;
    if ('owner_id' in dto) {
      data.owner_id = dto.owner_id ? dto.owner_id : null;
    }
    const result = await this.repo.update(id, data);
    if (dto.status !== undefined) {
      await this.rbacCache.bumpVersion();
    }
    return result;
  }

  async delete(id: PrimaryKey) {
    await this.getOne(id);
    await this.repo.delete(id);
    await this.rbacCache.bumpVersion();
    return { message: t(this.i18n, 'group.DELETED') };
  }

  async getMembers(id: PrimaryKey, query: any) {
    await this.getOne(id);
    const options = parseQueryOptions(query);
    const [data, total] = await Promise.all([
      this.repo.getMembers(id, options.skip, options.take),
      this.repo.countMembers(id),
    ]);
    return { data, meta: createPaginationMeta(options, total) };
  }

  async addMember(id: PrimaryKey, dto: AddMemberDto) {
    await this.getOne(id);
    await this.repo.addMember(id, dto.userId);
    await this.rbacCache.clearAllUserCaches(dto.userId);
    return { message: t(this.i18n, 'group.MEMBER_ADDED') };
  }

  async removeMember(id: PrimaryKey, userId: PrimaryKey) {
    await this.getOne(id);
    await this.repo.removeMember(id, userId);
    await this.rbacCache.clearAllUserCaches(userId);
    return { message: t(this.i18n, 'group.MEMBER_REMOVED') };
  }
}
