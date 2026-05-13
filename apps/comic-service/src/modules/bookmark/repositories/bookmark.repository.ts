import { Injectable } from '@nestjs/common';
import { Prisma } from 'src/generated/prisma';
import { toPrimaryKey } from 'src/types';
import { PrismaService } from '../../../core/database/prisma.service';

export interface BookmarkFilter {
  userId?: any;
  chapterId?: any;
}

@Injectable()
export class BookmarkRepository {
  constructor(private readonly prisma: PrismaService) {}

  private buildWhere(filter: BookmarkFilter): Prisma.BookmarkWhereInput {
    const where: Prisma.BookmarkWhereInput = {};
    if (filter.userId !== undefined) where.userId = toPrimaryKey(filter.userId);
    if (filter.chapterId !== undefined) where.chapterId = toPrimaryKey(filter.chapterId);
    return where;
  }

  findMany(filter: BookmarkFilter, options: { skip: number; take: number }) {
    return this.prisma.bookmark.findMany({
      where: this.buildWhere(filter),
      include: {
        chapter: {
          select: {
            id: true,
            title: true,
            chapterIndex: true,
            comic: { select: { id: true, title: true, slug: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: options.skip,
      take: options.take,
    });
  }

  count(filter: BookmarkFilter) {
    return this.prisma.bookmark.count({ where: this.buildWhere(filter) });
  }

  findById(id: any) {
    return this.prisma.bookmark.findUnique({ where: { id: toPrimaryKey(id) } });
  }

  /**
   * Upsert keyed on (userId, chapterId, pageNumber). Idempotent — a
   * double-tap from the client returns the same row instead of inserting a
   * duplicate. Requires the @@unique migration on the Bookmark model.
   */
  upsert(data: { userId: any; chapterId: any; pageNumber: number }) {
    const uid = toPrimaryKey(data.userId);
    const cid = toPrimaryKey(data.chapterId);
    return this.prisma.bookmark.upsert({
      where: {
        userId_chapterId_pageNumber: {
          userId: uid,
          chapterId: cid,
          pageNumber: data.pageNumber,
        },
      },
      create: {
        userId: uid,
        chapterId: cid,
        pageNumber: data.pageNumber,
      },
      // No fields actually need updating — refresh `createdAt` would be a
      // semantic change. Empty update is a no-op.
      update: {},
    });
  }

  delete(id: any) {
    return this.prisma.bookmark.delete({ where: { id: toPrimaryKey(id) } });
  }
}
