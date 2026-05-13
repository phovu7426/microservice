import { Injectable } from '@nestjs/common';
import { toPrimaryKey } from 'src/types';
import { PrismaService } from '../../../core/database/prisma.service';

@Injectable()
export class ViewTrackingRepository {
  constructor(private readonly prisma: PrismaService) {}

  upsertStats(comicId: any, count: number) {
    const cid = toPrimaryKey(comicId);
    return this.prisma.stats.upsert({
      where: { comicId: cid },
      create: { comicId: cid, viewCount: BigInt(count) },
      update: { viewCount: { increment: BigInt(count) } },
    });
  }

  upsertDailyStats(comicId: any, date: Date, count: number) {
    const cid = toPrimaryKey(comicId);
    return this.prisma.dailyStats.upsert({
      where: { comicId_statDate: { comicId: cid, statDate: date } },
      create: { comicId: cid, statDate: date, viewCount: BigInt(count) },
      update: { viewCount: { increment: BigInt(count) } },
    });
  }
}
