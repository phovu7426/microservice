import { Injectable, Inject, Optional, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { OutboxRelayService, EVENT_PRODUCER, IKafkaProducer } from '@package/common';
import { PrismaService } from '../../core/database/prisma.service';

const TABLE_NAME = 'outbox';
const TOPIC_MAP: Record<string, string> = {
  'user.registered': 'user.registered',
  'user.password.reset': 'user.password.reset',
  'mail.send': 'mail.send',
};

@Injectable()
export class AuthOutboxCronService implements OnModuleInit {
  constructor(
    private readonly outboxRelay: OutboxRelayService,
    private readonly prisma: PrismaService,
    @Optional() @Inject(EVENT_PRODUCER) private readonly producer?: IKafkaProducer,
  ) {}

  onModuleInit() {
    this.outboxRelay.init(this.prisma, { tableName: TABLE_NAME, topicMap: TOPIC_MAP, lockPrefix: 'auth' });
    if (this.producer) {
      this.outboxRelay.setProducer(this.producer);
    }
  }

  // Relay every 5 seconds. Connection pool increased to 20 (was 5), so the
  // extra ~12 idle queries/min per service is acceptable. Reduces event
  // delivery latency from up to 30s down to ≤5s.
  @Cron('*/5 * * * * *')
  async relayOutbox() {
    await this.outboxRelay.relay(TABLE_NAME, TOPIC_MAP);
  }
}
