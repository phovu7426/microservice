import { BadRequestException, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { RedisService } from '@package/redis';
import { CreateCategoryDto } from '../dtos/create-category.dto';
import { UpdateCategoryDto } from '../dtos/update-category.dto';
import { SlugHelper, t, createPaginationMeta, parseQueryOptions } from '@package/common';
import { PrimaryKey, toPrimaryKey } from 'src/types';
import { CategoryFilter, CategoryRepository } from '../../repositories/category.repository';

@Injectable()
export class AdminCategoryService {
  constructor(
    private readonly categoryRepo: CategoryRepository,
    private readonly i18n: I18nService,
    @Optional() private readonly redis?: RedisService,
  ) {}

  private async assertNoCycle(categoryId: any, candidateParentId: any): Promise<void> {
    if (String(categoryId) === String(candidateParentId)) {
      throw new BadRequestException(t(this.i18n, 'post.CATEGORY_CANNOT_BE_OWN_PARENT'));
    }
    const visited = new Set<string>();
    let current: bigint | null = toPrimaryKey(candidateParentId);
    while (current != null) {
      const key = String(current);
      if (visited.has(key)) break;
      visited.add(key);
      if (key === String(categoryId)) {
        throw new BadRequestException(t(this.i18n, 'post.CATEGORY_CYCLE_DETECTED'));
      }
      current = await this.categoryRepo.getParentId(current);
    }
  }

  async getList(query: any = {}) {
    const options = parseQueryOptions(query);

    const filter: CategoryFilter = {};
    if (query.search) filter.search = query.search;
    if (query.parentId !== undefined) {
      filter.parentId = query.parentId === 'null' ? null : query.parentId;
    }
    if (query.status) filter.status = query.status;

    const skipCount = query.skipCount === true || query.skipCount === 'true';
    const [data, total] = await Promise.all([
      this.categoryRepo.findMany(filter, options),
      skipCount ? Promise.resolve(0) : this.categoryRepo.count(filter),
    ]);

    return { data, meta: createPaginationMeta(options, total) };
  }

  async getOne(id: PrimaryKey) {
    const category = await this.categoryRepo.findById(id);
    if (!category) throw new NotFoundException(t(this.i18n, 'post.CATEGORY_NOT_FOUND'));
    return category;
  }

  async create(dto: CreateCategoryDto, actorId?: PrimaryKey) {
    const slug = await SlugHelper.uniqueSlug(dto.name, {
      findOne: (filter: any) => this.categoryRepo.findBySlug(filter.slug),
    });
    if ((dto as any).parentId) {
      // Refuse pointing at a non-existent parent at create-time. Cycles
      // can't exist yet because the new node has no descendants.
      const parent = await this.categoryRepo.findById((dto as any).parentId);
      if (!parent) throw new BadRequestException(t(this.i18n, 'post.PARENT_CATEGORY_NOT_FOUND'));
    }

    const data: Record<string, any> = { ...dto, slug };
    if (actorId) data.createdUserId = actorId;

    const result = await this.categoryRepo.create(data);
    await this.invalidateCategoryCache();
    return result;
  }

  async update(id: PrimaryKey, dto: UpdateCategoryDto, actorId?: PrimaryKey) {
    await this.getOne(id);

    const data: Record<string, any> = { ...dto };
    if (dto.name) {
      data.slug = await SlugHelper.uniqueSlug(
        dto.name,
        { findOne: (filter: any) => this.categoryRepo.findBySlug(filter.slug) },
        id,
      );
    }
    if ((dto as any).parentId) {
      await this.assertNoCycle(id, (dto as any).parentId);
    }
    if (actorId) data.updatedUserId = actorId;

    const result = await this.categoryRepo.update(id, data);
    await this.invalidateCategoryCache();
    return result;
  }

  async delete(id: PrimaryKey) {
    await this.getOne(id);
    await this.categoryRepo.delete(id);
    await this.invalidateCategoryCache();
    return { success: true };
  }

  private async invalidateCategoryCache(): Promise<void> {
    try {
      if (this.redis?.isEnabled()) {
        await this.redis.del('post:public:categories:list');
      }
    } catch {}
  }
}
