import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { GroupMemberRemovedEvent } from '@package/shared-types';
import { KafkaHandler } from '../interfaces/kafka-handler.interface';

@Injectable()
export class GroupMemberRemovedHandler implements KafkaHandler {
  constructor(private readonly prisma: PrismaService) {}

  async handle(payload: GroupMemberRemovedEvent): Promise<void> {
    const userId = BigInt(payload.user_id);
    const groupId = BigInt(payload.group_id);
    await this.prisma.userGroup.deleteMany({
      where: { userId, groupId },
    });
  }
}
