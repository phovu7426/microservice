import { Injectable, Logger, NotFoundException, Optional } from '@nestjs/common';
import { PrimaryKey } from 'src/types';
import { RedisService } from '@package/redis';
import { I18nService } from 'nestjs-i18n';
import { CreateCategoryDto } from '../dtos/create-category.dto';
import { UpdateCategoryDto } from '../dtos/update-category.dto';
import { SlugHelper, t, createPaginationMeta, parseQueryOptions } from '@package/common';
import { CategoryFilter, CategoryRepository } from '../../repositories/category.repository';

@Injectable()
export class AdminCategoryService {
  private readonly logger = new Logger(AdminCategoryService.name);

  constructor(
    private readonly categoryRepo: CategoryRepository,
    private readonly i18n: I18nService,
    @Optional() private readonly redis?: RedisService,
  ) {}

  async getList(query: any = {}) {
    const options = parseQueryOptions(query);

    const filter: CategoryFilter = {};
    if (query.search) filter.search = query.search;

    const skipCount = query.skipCount === true || query.skipCount === 'true';
    const [data, total] = await Promise.all([
      this.categoryRepo.findMany(filter, options),
      skipCount ? Promise.resolve(0) : this.categoryRepo.count(filter),
    ]);

    return { data, meta: createPaginationMeta(options, total) };
  }

  async getOne(id: PrimaryKey) {
    const category = await this.categoryRepo.findById(id);
    if (!category) throw new NotFoundException(t(this.i18n, 'comic.CATEGORY_NOT_FOUND'));
    return category;
  }

  async create(dto: CreateCategoryDto, actorId?: PrimaryKey) {
    const slug = await SlugHelper.uniqueSlug(dto.name, {
      findOne: (filter: any) => this.categoryRepo.findBySlug(filter.slug),
    });

    const created = await this.categoryRepo.create({ ...dto, slug, createdUserId: actorId, updatedUserId: actorId });
    await this.clearCategoryCaches();
    return created;
  }

  async update(id: PrimaryKey, dto: UpdateCategoryDto, actorId?: PrimaryKey) {
    await this.getOne(id);
    const data: Record<string, any> = { ...dto };
    if (actorId) data.updatedUserId = actorId;

    if (dto.name) {
      data.slug = await SlugHelper.uniqueSlug(
        dto.name,
        { findOne: (filter: any) => this.categoryRepo.findBySlug(filter.slug) },
        id,
      );
    }

    const updated = await this.categoryRepo.update(id, data);
    await this.clearCategoryCaches();
    return updated;
  }

  async delete(id: PrimaryKey) {
    await this.getOne(id);
    await this.categoryRepo.delete(id);
    await this.clearCategoryCaches();
    return { success: true };
  }

  private async clearCategoryCaches(): Promise<void> {
    try {
      await this.redis?.del('comic:public:categories');
    } catch (err: any) {
      this.logger.warn('Failed to clear category caches', (err as Error).message);
    }
  }
}
