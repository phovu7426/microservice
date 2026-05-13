import { Injectable } from '@nestjs/common';
import { Prisma } from 'src/generated/prisma';
import { toPrimaryKey } from 'src/types';
import { PrismaService } from '../../../core/database/prisma.service';

export interface ReadingHistoryFilter {
  userId?: any;
  comicId?: any;
}

@Injectable()
export class ReadingHistoryRepository {
  constructor(private readonly prisma: PrismaService) {}

  private buildWhere(filter: ReadingHistoryFilter): Prisma.ReadingHistoryWhereInput {
    const where: Prisma.ReadingHistoryWhereInput = {};
    if (filter.userId !== undefined) where.userId = toPrimaryKey(filter.userId);
    if (filter.comicId !== undefined) where.comicId = toPrimaryKey(filter.comicId);
    return where;
  }

  findMany(filter: ReadingHistoryFilter, options: { skip: number; take: number }) {
    return this.prisma.readingHistory.findMany({
      where: this.buildWhere(filter),
      include: {
        comic: { select: { id: true, title: true, slug: true, coverImage: true } },
        chapter: { select: { id: true, title: true, chapterIndex: true, chapterLabel: true } },
      },
      orderBy: { updatedAt: 'desc' },
      skip: options.skip,
      take: options.take,
    });
  }

  count(filter: ReadingHistoryFilter) {
    return this.prisma.readingHistory.count({ where: this.buildWhere(filter) });
  }

  /**
   * Track furthest chapter a user has read for a comic. Two parallel reads
   * of different chapters used to race — the loser by SQL order overwrote
   * the winner. We compare `chapterIndex` inside a transaction so the
   * pointer only moves forward (or stays put on re-reads of earlier
   * chapters).
   */
  async upsert(userId: any, comicId: any, chapterId: any) {
    const uid = toPrimaryKey(userId);
    const cid = toPrimaryKey(comicId);
    const chid = toPrimaryKey(chapterId);

    return this.prisma.$transaction(async (tx) => {
      const incoming = await tx.chapter.findUnique({
        where: { id: chid },
        select: { chapterIndex: true, comicId: true },
      });
      if (!incoming || incoming.comicId !== cid) {
        throw new Error('Chapter does not belong to comic');
      }

      const existing = await tx.readingHistory.findUnique({
        where: { userId_comicId: { userId: uid, comicId: cid } },
        include: { chapter: { select: { chapterIndex: true } } },
      });

      if (!existing) {
        return tx.readingHistory.create({
          data: { userId: uid, comicId: cid, chapterId: chid },
        });
      }

      if (existing.chapterId === chid) {
        return tx.readingHistory.update({
          where: { userId_comicId: { userId: uid, comicId: cid } },
          data: { updatedAt: new Date() },
        });
      }

      const incomingIdx = incoming.chapterIndex ?? 0;
      const existingIdx = existing.chapter?.chapterIndex ?? 0;
      if (incomingIdx >= existingIdx) {
        return tx.readingHistory.update({
          where: { userId_comicId: { userId: uid, comicId: cid } },
          data: { chapterId: chid },
        });
      }
      return existing;
    });
  }

  deleteByUserComic(filter: ReadingHistoryFilter) {
    return this.prisma.readingHistory.deleteMany({ where: this.buildWhere(filter) });
  }
}
