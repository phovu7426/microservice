import { BadRequestException, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { RedisService } from '@package/redis';
import { t, createPaginationMeta, parseQueryOptions } from '@package/common';
import { PrimaryKey } from 'src/types';
import { NotificationRepository, NotificationFilter } from '../../repositories/notification.repository';
import { SendNotificationDto } from '../dtos/send-notification.dto';
import { ListNotificationsAdminQueryDto } from '../dtos/list-notifications.query.dto';

const NUMERIC_RE = /^\d{1,20}$/;

@Injectable()
export class AdminNotificationService {
  constructor(
    private readonly notifRepo: NotificationRepository,
    private readonly i18n: I18nService,
    @Optional() private readonly redis?: RedisService,
  ) {}

  async getList(query: ListNotificationsAdminQueryDto) {
    const options = parseQueryOptions(query);

    const filter: NotificationFilter = {};
    if (query.user_id) {
      if (!NUMERIC_RE.test(String(query.user_id))) {
        throw new BadRequestException(t(this.i18n, 'notification.INVALID_USER_ID'));
      }
      filter.user_id = String(query.user_id);
    }
    if (query.type) filter.type = query.type;
    if (query.status) filter.status = query.status;
    if (query.is_read !== undefined) filter.is_read = query.is_read === 'true';

    const skipCount = query.skipCount === 'true';
    const [data, total] = await Promise.all([
      this.notifRepo.findMany(filter, options),
      skipCount ? Promise.resolve(0) : this.notifRepo.count(filter),
    ]);

    return { data, meta: createPaginationMeta(options, total) };
  }

  async send(dto: SendNotificationDto) {
    const result = await this.notifRepo.createMany(
      dto.user_ids.map((user_id) => ({
        user_id,
        title: dto.title,
        message: dto.message,
        type: dto.type,
        data: dto.data,
        status: 'active',
      })),
    );
    await this.invalidateUnreadCounts(dto.user_ids);
    return result;
  }

  async delete(id: PrimaryKey) {
    const notif = await this.notifRepo.findById(id);
    if (!notif) throw new NotFoundException(t(this.i18n, 'notification.NOT_FOUND'));
    await this.notifRepo.delete(id);
    return true;
  }

  // --- internal methods called from Kafka events ---

  async create(data: { user_id: string | bigint; title: string; message: string; type?: string; data?: any }) {
    const result = await this.notifRepo.create({ ...data, status: 'active' });
    await this.invalidateUnreadCounts([data.user_id]);
    return result;
  }

  async createMany(notifications: Array<{ user_id: string | bigint; title: string; message: string; type?: string; data?: any }>) {
    const result = await this.notifRepo.createMany(notifications.map((n) => ({ ...n, status: 'active' })));
    const userIds = [...new Set(notifications.map((n) => n.user_id))];
    await this.invalidateUnreadCounts(userIds);
    return result;
  }

  private async invalidateUnreadCounts(userIds: Array<string | bigint>): Promise<void> {
    try {
      if (!this.redis) return;
      await Promise.all(
        userIds.map((uid) => this.redis!.del(`notif:unread:${uid}`)),
      );
    } catch {}
  }
}
