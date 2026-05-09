import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Optional,
} from '@nestjs/common';
import { RedisService } from '@package/redis';
import { I18nContext, I18nService } from 'nestjs-i18n';
import { MenuRepository, MenuFilter } from '../../repositories/menu.repository';
import { MenuTreeItem } from '../../interfaces/menu-tree-item.interface';
import { buildMenuTree } from '../../helpers/menu.helper';
import { createPaginationMeta, parseQueryOptions } from '@package/common';

@Injectable()
export class MenuService {
  constructor(
    private readonly menuRepo: MenuRepository,
    private readonly i18n: I18nService,
    @Optional() private readonly redis?: RedisService,
  ) {}

  private t(key: string): string {
    const lang = I18nContext.current()?.lang ?? 'en';
    return this.i18n.t(key, { lang }) as string;
  }

  async getList(query: any = {}) {
    const options = parseQueryOptions(query);

    const filter: MenuFilter = {};
    if (query.search) filter.search = query.search;
    if (query.status) filter.status = query.status;
    if (query.type) filter.type = query.type;
    if (query.parentId !== undefined) filter.parentId = query.parentId;
    if (query.group) filter.group = query.group;

    const skipCount = query.skipCount === true || query.skipCount === 'true';
    const [data, total] = await Promise.all([
      this.menuRepo.findMany(filter, options),
      skipCount ? Promise.resolve(0) : this.menuRepo.count(filter),
    ]);

    return { data, meta: createPaginationMeta(options, total) };
  }

  async getSimpleList(query: any = {}) {
    return this.getList({
      ...query,
      limit: query.limit ?? 50,
      sort: query.sort ?? 'sort_order:ASC',
      skipCount: true,
    });
  }

  async getOne(id: any) {
    const item = await this.menuRepo.findById(id);
    if (!item) throw new NotFoundException(this.t('menu.NOT_FOUND'));
    return item;
  }

  async create(dto: any) {
    if (dto.code && (await this.menuRepo.findByCode(dto.code))) {
      throw new BadRequestException(this.t('menu.CODE_EXISTS'));
    }
    if (dto.parentId) {
      const parent = await this.menuRepo.findById(dto.parentId);
      if (!parent) throw new BadRequestException(this.t('menu.PARENT_NOT_FOUND'));
    }
    try {
      const created = await this.menuRepo.create(dto);
      await this.clearMenuCaches();
      return created;
    } catch (err: any) {
      // P2002 = unique-constraint race (concurrent create with same code).
      if (err?.code === 'P2002') {
        throw new BadRequestException(this.t('menu.CODE_EXISTS'));
      }
      throw err;
    }
  }

  async createWithUser(dto: any, userId?: any) {
    if (userId) dto.created_user_id = userId;
    return this.create(dto);
  }

  async update(id: any, dto: any) {
    const current = await this.getOne(id);
    if (dto.code && dto.code !== (current as any).code) {
      if (await this.menuRepo.findByCode(dto.code)) {
        throw new BadRequestException(this.t('menu.CODE_EXISTS'));
      }
    }
    if (dto.parentId !== undefined && dto.parentId !== null && dto.parentId !== '') {
      await this.assertNoCycle(id, dto.parentId);
      const parent = await this.menuRepo.findById(dto.parentId);
      if (!parent) throw new BadRequestException(this.t('menu.PARENT_NOT_FOUND'));
    }
    try {
      const updated = await this.menuRepo.update(id, dto);
      await this.clearMenuCaches();
      return updated;
    } catch (err: any) {
      if (err?.code === 'P2002') {
        throw new BadRequestException(this.t('menu.CODE_EXISTS'));
      }
      throw err;
    }
  }

  async updateById(id: any, dto: any, userId?: any) {
    if (userId) dto.updated_user_id = userId;
    return this.update(id, dto);
  }

  async delete(id: any) {
    await this.getOne(id);
    await this.menuRepo.delete(id);
    await this.clearMenuCaches();
    return true;
  }

  async getTree(): Promise<MenuTreeItem[]> {
    const menus = await this.menuRepo.findAllWithChildren({});
    return buildMenuTree(menus);
  }

  private async clearMenuCaches(): Promise<void> {
    await this.redis?.del('config:public:menu');
  }

  /**
   * Reject parentId pointing at the menu itself or any of its descendants —
   * doing so would create an infinite loop in tree traversal.
   */
  private async assertNoCycle(menuId: any, candidateParentId: any): Promise<void> {
    if (String(menuId) === String(candidateParentId)) {
      throw new BadRequestException(this.t('menu.CYCLE_DETECTED'));
    }
    const visited = new Set<string>();
    let current: any = candidateParentId;
    while (current != null) {
      const key = String(current);
      if (visited.has(key)) break;
      visited.add(key);
      if (key === String(menuId)) {
        throw new BadRequestException(this.t('menu.CYCLE_DETECTED'));
      }
      const node: any = await this.menuRepo.findById(current);
      current = node?.parent_id ?? null;
    }
  }
}
