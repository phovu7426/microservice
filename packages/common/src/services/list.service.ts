import { NotFoundException } from '@nestjs/common';
import { I18nContext } from 'nestjs-i18n';
import { IPaginatedResult } from '../repository/prisma.repository';
import { createPaginationMeta } from '../helpers/pagination.helper';
import { commonMsg } from '../i18n/common-messages';

/**
 * Interface tối thiểu mà base service cần.
 * Chỉ gồm các method được gọi trực tiếp bởi ListService / CrudService.
 * Các method khác (findManyByIds, exists, count...) nằm ở PrismaRepository.
 */
export interface IRepository<T> {
  findAll(query?: Record<string, any>): Promise<IPaginatedResult<T>>;
  findById(id: any): Promise<T | null>;
  /** Lightweight list với ít field hơn. Implement khi cần select riêng cho getSimpleList. */
  findSimple?(query?: Record<string, any>): Promise<{ data: T[] }>;
  create(data: any): Promise<T>;
  update(id: any, data: any): Promise<T>;
  delete(id: any): Promise<any>;
}

/**
 * Base class cung cấp getList, getSimpleList, getOne.
 * Kế thừa khi service chỉ cần đọc dữ liệu (public API, read-only).
 *
 * Nhận flat query object: { page, limit, sort, search, status, ... }
 * Repository.findAll() cũng nhận thẳng flat query này.
 */
export abstract class ListService<R extends IRepository<any>, T = R extends IRepository<infer U> ? U : never> {
  constructor(protected readonly repository: R) {}

  /**
   * Normalize page / limit / sort từ flat query.
   * Các field khác (filter) giữ nguyên trong object.
   */
  protected prepareQuery(query: Record<string, any>): Record<string, any> {
    const page = Math.max(Number(query.page) || 1, 1);
    const maxLimit = Number(query.maxLimit) || 100;
    const limit = Math.min(Math.max(Number(query.limit) || 10, 1), maxLimit);
    const sort = query.sort || 'id:DESC';
    return { ...query, page, limit, sort };
  }

  /**
   * Hook để thêm / sửa điều kiện trước khi query.
   * Nhận flat query đã được normalize, trả về flat query đã chỉnh.
   * Trả về false để trả về danh sách rỗng ngay lập tức.
   */
  protected async prepareFilters(
    query: Record<string, any>,
  ): Promise<Record<string, any> | false> {
    return query;
  }

  protected async afterGetList(result: IPaginatedResult<T>): Promise<IPaginatedResult<T>> {
    return result;
  }

  protected async afterGetOne(entity: T | null): Promise<T | null> {
    return entity;
  }

  protected transform(entity: T | null): T | null | Promise<T | null> {
    return entity;
  }

  async getSimpleList(query: Record<string, any> = {}) {
    const limit = Math.min(Number(query.limit) || 100, 100);
    const normalized = this.prepareQuery({ ...query, limit, skipCount: true });
    const filtered = await this.prepareFilters(normalized);
    if (filtered === false) return [];
    if (this.repository.findSimple) {
      const result = await this.repository.findSimple(filtered);
      return result.data;
    }
    const result = await this.repository.findAll(filtered);
    return result.data;
  }

  async getList(query: Record<string, any> = {}): Promise<IPaginatedResult<T>> {
    const normalized = this.prepareQuery(query);
    const filtered = await this.prepareFilters(normalized);

    if (filtered === false) {
      const page = normalized.page as number;
      const limit = normalized.limit as number;
      return {
        data: [],
        meta: createPaginationMeta({ page, skip: (page - 1) * limit, take: limit }, 0),
      };
    }

    const result = await this.repository.findAll(filtered);
    const rawTransforms = result.data.map((row) => this.transform(row));
    const hasAsync = rawTransforms.some((t) => t instanceof Promise);
    const transformedData = hasAsync
      ? await Promise.all(rawTransforms.map((t) => (t instanceof Promise ? t : Promise.resolve(t))))
      : (rawTransforms as (T | null)[]);
    result.data = transformedData as T[];
    return this.afterGetList(result);
  }

  async getOne(id: any): Promise<T> {
    const lang = I18nContext.current()?.lang ?? 'vi';
    const entity = await this.repository.findById(id);
    if (!entity) throw new NotFoundException(commonMsg(lang, 'RESOURCE_NOT_FOUND_ID', { id: String(id) }));
    const transformed = this.transform(entity) as T;
    const final = await this.afterGetOne(transformed);
    if (!final) throw new NotFoundException(commonMsg(lang, 'RESOURCE_NOT_FOUND_ID', { id: String(id) }));
    return final;
  }
}
