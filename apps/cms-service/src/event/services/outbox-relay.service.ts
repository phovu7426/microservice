import { Injectable, Inject, Optional, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { OutboxRelayService, EVENT_PRODUCER, IKafkaProducer } from '@package/common';
import { PrismaService } from '../../core/database/prisma.service';

const TABLE_NAME = 'outbox';
const TOPIC_MAP: Record<string, string> = {
  'contact.submitted': 'contact.submitted',
};

@Injectable()
export class OutboxCronService implements OnModuleInit {
  constructor(
    private readonly outboxRelay: OutboxRelayService,
    private readonly prisma: PrismaService,
    @Optional() @Inject(EVENT_PRODUCER) private readonly producer?: IKafkaProducer,
  ) {}

  onModuleInit() {
    this.outboxRelay.init(this.prisma, { tableName: TABLE_NAME, topicMap: TOPIC_MAP, lockPrefix: 'cms' });
    if (this.producer) this.outboxRelay.setProducer(this.producer);
  }

  @Cron('*/5 * * * * *')
  async relayOutbox() {
    await this.outboxRelay.relay(TABLE_NAME, TOPIC_MAP);
  }
}
