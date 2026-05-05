import { Injectable, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { OutboxRelayService } from '@package/common';
import { PrismaService } from '../../core/database/prisma.service';

const TABLE_NAME = 'outbox';
const TOPIC_MAP: Record<string, string> = {
  'role.changed': 'role.changed',
  'permission.changed': 'permission.changed',
  'role.permission.changed': 'role.permission.changed',
  'user.role.assigned': 'user.role.assigned',
  'user.role.revoked': 'user.role.revoked',
  'rbac.cache.invalidate': 'rbac.cache.invalidate',
};

@Injectable()
export class IamOutboxCronService implements OnModuleInit {
  constructor(
    private readonly outboxRelay: OutboxRelayService,
    private readonly prisma: PrismaService,
  ) {}

  onModuleInit() {
    this.outboxRelay.init(this.prisma, {
      tableName: TABLE_NAME,
      topicMap: TOPIC_MAP,
    });
  }

  @Cron('*/30 * * * * *')
  async relayOutbox() {
    await this.outboxRelay.relay(TABLE_NAME, TOPIC_MAP);
  }
}
