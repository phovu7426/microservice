import { Injectable } from '@nestjs/common';
import { PrimaryKey } from 'src/types';
import { PrismaService } from '../../../core/database/prisma.service';

@Injectable()
export class StatsRepository {
  constructor(private readonly prisma: PrismaService) {}

  upsertStats(postId: PrimaryKey, count: number) {
    return this.prisma.stats.upsert({
      where: { postId: postId },
      create: { postId: postId, viewCount: BigInt(count) },
      update: { viewCount: { increment: BigInt(count) } },
    });
  }

  upsertDailyStats(postId: PrimaryKey, date: Date, count: number) {
    return this.prisma.dailyStats.upsert({
      where: { postId_statDate: { postId: postId, statDate: date } },
      create: { postId: postId, statDate: date, viewCount: BigInt(count) },
      update: { viewCount: { increment: BigInt(count) } },
    });
  }
}
