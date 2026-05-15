import { IRepository } from './list.service';
import { CrudService } from './crud.service';
import { getSessionGroupId } from '../session/group-filter.helper';

/**
 * Extends CrudService với group-scope filtering tự động.
 *
 * Khi request có header `x-group-id`, `prepareFilters` sẽ tự động gọi
 * `applyGroupFilter` để inject điều kiện lọc theo group trước khi query.
 *
 * Subclass override `applyGroupFilter` để tùy chỉnh cách merge (ví dụ:
 * Prisma relation filter `userGroups.some` thay vì field `groupId` đơn giản).
 */
export abstract class GroupAwareService<R extends IRepository<any>, T = R extends IRepository<infer U> ? U : never> extends CrudService<R, T> {
  /**
   * Merge groupId vào filter object.
   * Default: thêm field `groupId` dạng string — dùng cho bảng có cột groupId trực tiếp.
   * Override khi cần logic khác (relation filter, multi-tenant, v.v.).
   */
  protected applyGroupFilter(
    query: Record<string, any>,
    groupId: bigint,
  ): Record<string, any> {
    return { ...query, groupId: String(groupId) };
  }

  protected async prepareFilters(
    query: Record<string, any>,
  ): Promise<Record<string, any> | false> {
    const base = await super.prepareFilters(query);
    if (base === false) return false;

    const groupId = getSessionGroupId();
    if (!groupId) return base;

    return this.applyGroupFilter(base, groupId);
  }
}
