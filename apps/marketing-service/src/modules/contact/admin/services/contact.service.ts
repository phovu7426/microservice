import { Injectable, NotFoundException, Optional } from '@nestjs/common';
import { PrimaryKey } from 'src/types';
import { RedisService } from '@package/redis';
import { createPaginationMeta, parseQueryOptions } from '@package/common';
import { ContactFilter, ContactRepository } from '../../repositories/contact.repository';

@Injectable()
export class AdminContactService {
  constructor(
    private readonly contactRepo: ContactRepository,
    @Optional() private readonly redis?: RedisService,
  ) {}

  private async clearCache(): Promise<void> {
    await this.redis?.del('marketing:admin:contacts:list').catch(() => {});
  }

  async getList(query: any = {}) {
    const options = parseQueryOptions(query);

    const filter: ContactFilter = {};
    if (query.search) filter.search = query.search;
    if (query.status) filter.status = query.status;
    if (query.email) filter.email = query.email;

    const skipCount = query.skipCount === true || query.skipCount === 'true';
    const [data, total] = await Promise.all([
      this.contactRepo.findMany(filter, options),
      skipCount ? Promise.resolve(0) : this.contactRepo.count(filter),
    ]);

    return { data, meta: createPaginationMeta(options, total) };
  }

  async getOne(id: PrimaryKey) {
    const contact = await this.contactRepo.findById(id);
    if (!contact) throw new NotFoundException('Contact not found');
    return contact;
  }

  async reply(id: PrimaryKey, replyText: string, actorId?: PrimaryKey) {
    await this.getOne(id);
    const updated = await this.contactRepo.update(id, {
      reply: replyText,
      status: 'Replied',
      repliedAt: new Date(),
      repliedBy: actorId,
    });
    await this.clearCache();
    return updated;
  }

  async markAsRead(id: PrimaryKey) {
    await this.getOne(id);
    const updated = await this.contactRepo.update(id, { status: 'Read' });
    await this.clearCache();
    return updated;
  }

  async closeContact(id: PrimaryKey) {
    await this.getOne(id);
    const updated = await this.contactRepo.update(id, { status: 'Closed' });
    await this.clearCache();
    return updated;
  }
}
