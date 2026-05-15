import { NotFoundException } from '@nestjs/common';
import { IRepository, ListService } from './list.service';

/**
 * Extends ListService với đầy đủ CRUD: create, update, delete.
 * Kế thừa khi service cần admin CRUD (thêm, sửa, xóa).
 */
export abstract class CrudService<T, R extends IRepository<T>> extends ListService<T, R> {
  protected async beforeCreate(data: any): Promise<any> {
    return { ...data };
  }

  protected async afterCreate(_entity: T, _data: any): Promise<void> {}

  protected async beforeUpdate(_id: any, data: any): Promise<any> {
    return data;
  }

  protected async afterUpdate(_entity: T, _data: any): Promise<void> {}

  protected async beforeDelete(_id: any): Promise<boolean> {
    return true;
  }

  protected async afterDelete(_id: any, _entity?: any): Promise<void> {}

  async create(data: any): Promise<T> {
    const payload = await this.beforeCreate(data);
    const entity = await this.repository.create(payload);
    await this.afterCreate(entity, data);
    return this.transform(entity) as T;
  }

  async update(id: any, data: any): Promise<T> {
    const payload = await this.beforeUpdate(id, data);
    const entity = await this.repository.update(id, payload);
    if (!entity) throw new NotFoundException(`Resource with ID ${id} not found to update`);
    await this.afterUpdate(entity, data);
    return this.transform(entity) as T;
  }

  async delete(id: any): Promise<any> {
    const canDelete = await this.beforeDelete(id);
    if (!canDelete) return false;
    const result = await this.repository.delete(id);
    if (result) await this.afterDelete(id);
    return result;
  }
}
