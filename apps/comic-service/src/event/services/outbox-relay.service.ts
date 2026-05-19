import { Injectable, Inject, Optional, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { OutboxRelayService, EVENT_PRODUCER, IKafkaProducer } from '@package/common';
import { PrismaService } from '../../core/database/prisma.service';

const TABLE_NAME = 'outbox';
const TOPIC_MAP: Record<string, string> = {
  'comic.chapter.published': 'comic.chapter.published',
  'comic.comment.created': 'comic.comment.created',
  'user.followed.comic': 'user.followed.comic',
  'user.unfollowed.comic': 'user.unfollowed.comic',
};

@Injectable()
export class OutboxCronService implements OnModuleInit {
  constructor(
    private readonly outboxRelay: OutboxRelayService,
    private readonly prisma: PrismaService,
    @Optional() @Inject(EVENT_PRODUCER) private readonly producer?: IKafkaProducer,
  ) {}

  onModuleInit() {
    this.outboxRelay.init(this.prisma, { tableName: TABLE_NAME, topicMap: TOPIC_MAP, lockPrefix: 'comic' });
    if (this.producer) this.outboxRelay.setProducer(this.producer);
  }

  // 5s relay — see auth-service outbox cron for rationale.
  @Cron('*/5 * * * * *')
  async relayOutbox() {
    await this.outboxRelay.relay(TABLE_NAME, TOPIC_MAP);
  }
}
