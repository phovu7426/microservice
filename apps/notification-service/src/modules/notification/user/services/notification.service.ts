import { Injectable, NotFoundException, Optional } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { RedisService } from '@package/redis';
import { t, createPaginationMeta, parseQueryOptions } from '@package/common';
import { PrimaryKey } from 'src/types';
import { NotificationRepository, NotificationFilter } from '../../repositories/notification.repository';
import { ListNotificationsUserQueryDto } from '../dtos/list-notifications.query.dto';

@Injectable()
export class UserNotificationService {
  constructor(
    private readonly notifRepo: NotificationRepository,
    private readonly i18n: I18nService,
    @Optional() private readonly redis?: RedisService,
  ) {}

  async getList(userId: string, query: ListNotificationsUserQueryDto) {
    const options = parseQueryOptions(query);

    const filter: NotificationFilter = { user_id: userId, status: 'active' };
    if (query.type) filter.type = query.type;
    if (query.is_read !== undefined) filter.is_read = query.is_read === 'true';

    const skipCount = query.skipCount === 'true';
    const [data, total] = await Promise.all([
      this.notifRepo.findMany(filter, options),
      skipCount ? Promise.resolve(0) : this.notifRepo.count(filter),
    ]);

    return { data, meta: createPaginationMeta(options, total) };
  }

  async getUnreadCount(userId: string) {
    const cacheKey = `notif:unread:${userId}`;
    try {
      const cached = await this.redis?.get(cacheKey);
      if (cached !== undefined && cached !== null) return { count: Number(cached) };
    } catch {}

    const count = await this.notifRepo.count({ user_id: userId, is_read: false, status: 'active' });

    try {
      await this.redis?.set(cacheKey, String(count), 30);
    } catch {}

    return { count };
  }

  async getOne(userId: string, id: PrimaryKey) {
    const notif = await this.notifRepo.findFirst({ id, user_id: userId });
    if (!notif) throw new NotFoundException(t(this.i18n, 'notification.NOT_FOUND'));
    return notif;
  }

  async markAsRead(userId: string, id: PrimaryKey) {
    const notif = await this.getOne(userId, id);
    const result = await this.notifRepo.update(notif.id, { is_read: true, read_at: new Date() });
    await this.invalidateUnreadCount(userId);
    return result;
  }

  async markAllAsRead(userId: string) {
    const result = await this.notifRepo.updateMany(
      { user_id: userId, is_read: false },
      { is_read: true, read_at: new Date() },
    );
    await this.invalidateUnreadCount(userId);
    return { updated: result.count };
  }

  async invalidateUnreadCount(userId: string): Promise<void> {
    try {
      await this.redis?.del(`notif:unread:${userId}`);
    } catch {}
  }
}
