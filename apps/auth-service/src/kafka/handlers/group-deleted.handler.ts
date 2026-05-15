import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { GroupDeletedEvent } from '@package/shared-types';
import { KafkaHandler } from '../interfaces/kafka-handler.interface';

@Injectable()
export class GroupDeletedHandler implements KafkaHandler {
  constructor(private readonly prisma: PrismaService) {}

  async handle(payload: GroupDeletedEvent): Promise<void> {
    const groupId = BigInt(payload.group_id);
    await this.prisma.userGroup.deleteMany({ where: { groupId } });
  }
}
