import { Injectable, NotFoundException, Optional } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { RedisService } from '@package/redis';
import { CreateTagDto } from '../dtos/create-tag.dto';
import { UpdateTagDto } from '../dtos/update-tag.dto';
import { SlugHelper, t, createPaginationMeta, parseQueryOptions } from '@package/common';
import { PrimaryKey } from 'src/types';
import { TagFilter, TagRepository } from '../../repositories/tag.repository';

@Injectable()
export class AdminTagService {
  constructor(
    private readonly tagRepo: TagRepository,
    private readonly i18n: I18nService,
    @Optional() private readonly redis?: RedisService,
  ) {}

  async getList(query: any = {}) {
    const options = parseQueryOptions(query);

    const filter: TagFilter = {};
    if (query.search) filter.search = query.search;
    if (query.isActive !== undefined) {
      filter.isActive = query.isActive === 'true' || query.isActive === true;
    }

    const skipCount = query.skipCount === true || query.skipCount === 'true';
    const [data, total] = await Promise.all([
      this.tagRepo.findMany(filter, options),
      skipCount ? Promise.resolve(0) : this.tagRepo.count(filter),
    ]);

    return { data, meta: createPaginationMeta(options, total) };
  }

  async getOne(id: PrimaryKey) {
    const tag = await this.tagRepo.findById(id);
    if (!tag) throw new NotFoundException(t(this.i18n, 'post.TAG_NOT_FOUND'));
    return tag;
  }

  async create(dto: CreateTagDto, actorId?: PrimaryKey) {
    const slug = await SlugHelper.uniqueSlug(dto.name, {
      findOne: (filter: any) => this.tagRepo.findBySlug(filter.slug),
    });

    const data: Record<string, any> = { ...dto, slug };
    if (actorId) data.createdUserId = actorId;

    const result = await this.tagRepo.create(data);
    await this.invalidateTagCache();
    return result;
  }

  async update(id: PrimaryKey, dto: UpdateTagDto, actorId?: PrimaryKey) {
    await this.getOne(id);

    const data: Record<string, any> = { ...dto };
    if (dto.name) {
      data.slug = await SlugHelper.uniqueSlug(
        dto.name,
        { findOne: (filter: any) => this.tagRepo.findBySlug(filter.slug) },
        id,
      );
    }
    if (actorId) data.updatedUserId = actorId;

    const result = await this.tagRepo.update(id, data);
    await this.invalidateTagCache();
    return result;
  }

  async delete(id: PrimaryKey) {
    await this.getOne(id);
    await this.tagRepo.delete(id);
    await this.invalidateTagCache();
    return { success: true };
  }

  private async invalidateTagCache(): Promise<void> {
    try {
      if (this.redis?.isEnabled()) {
        await this.redis.del('post:public:tags:list');
      }
    } catch {}
  }
}
