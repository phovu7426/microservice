import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { GroupMemberAddedEvent } from '@package/shared-types';
import { KafkaHandler } from '../interfaces/kafka-handler.interface';

@Injectable()
export class GroupMemberAddedHandler implements KafkaHandler {
  constructor(private readonly prisma: PrismaService) {}

  async handle(payload: GroupMemberAddedEvent): Promise<void> {
    const userId = BigInt(payload.user_id);
    const groupId = BigInt(payload.group_id);
    await this.prisma.userGroup.upsert({
      where: { userId_groupId: { userId, groupId } },
      create: { userId, groupId },
      update: {},
    });
  }
}
