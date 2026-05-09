import { Injectable, NotFoundException, Optional } from '@nestjs/common';
import { RedisService } from '@package/redis';
import { I18nContext, I18nService } from 'nestjs-i18n';
import { WardRepository, WardFilter } from '../../repositories/ward.repository';
import { createPaginationMeta, parseQueryOptions } from '@package/common';

@Injectable()
export class WardService {
  constructor(
    private readonly wardRepo: WardRepository,
    private readonly i18n: I18nService,
    @Optional() private readonly redis?: RedisService,
  ) {}

  async getList(query: any = {}) {
    const options = parseQueryOptions(query);

    const filter: WardFilter = {};
    if (query.name) filter.name = query.name;
    if (query.status) filter.status = query.status;
    if (query.code) filter.code = query.code;
    if (query.provinceId) filter.provinceId = query.provinceId;

    const skipCount = query.skipCount === true || query.skipCount === 'true';
    const [data, total] = await Promise.all([
      this.wardRepo.findMany(filter, options),
      skipCount ? Promise.resolve(0) : this.wardRepo.count(filter),
    ]);

    return { data, meta: createPaginationMeta(options, total) };
  }

  async getSimpleList(query: any = {}) {
    return this.getList({ ...query, limit: query.limit ?? 1000, skipCount: true });
  }

  async getOne(id: any) {
    const item = await this.wardRepo.findById(id);
    if (!item) {
      const lang = I18nContext.current()?.lang ?? 'en';
      throw new NotFoundException(
        this.i18n.t('location.WARD_NOT_FOUND', { lang, args: { id: String(id) } }),
      );
    }
    return item;
  }

  async create(dto: any) {
    const created = await this.wardRepo.create(dto);
    await this.clearWardCaches();
    return created;
  }

  async update(id: any, dto: any) {
    await this.getOne(id);
    const updated = await this.wardRepo.update(id, dto);
    await this.clearWardCaches();
    return updated;
  }

  async delete(id: any) {
    await this.getOne(id);
    await this.wardRepo.delete(id);
    await this.clearWardCaches();
    return true;
  }

  private async clearWardCaches(): Promise<void> {
    const keys = await this.redis?.keys('config:public:wards:*');
    if (keys?.length) await this.redis?.deleteMany(keys);
  }
}
