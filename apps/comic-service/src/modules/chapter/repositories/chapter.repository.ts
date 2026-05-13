import { Injectable } from '@nestjs/common';
import { Prisma } from 'src/generated/prisma';
import { toPrimaryKey } from 'src/types';
import { PrismaService } from '../../../core/database/prisma.service';
import { ChapterStatus } from '../enums/chapter-status.enum';

type Tx = Prisma.TransactionClient | PrismaService;

const ALLOWED_FIELDS: ReadonlySet<string> = new Set([
  'comicId',
  'teamId',
  'title',
  'chapterIndex',
  'chapterLabel',
  'status',
  'createdUserId',
  'updatedUserId',
]);

export interface ChapterFilter {
  comicId?: any;
  status?: string;
  teamId?: any;
}

const WITH_PAGES = {
  pages: { orderBy: { pageNumber: 'asc' as const } },
} as const;

const SIMPLE_SELECT = {
  id: true,
  title: true,
  chapterIndex: true,
  chapterLabel: true,
  status: true,
} as const;

@Injectable()
export class ChapterRepository {
  constructor(private readonly prisma: PrismaService) {}

  private buildWhere(filter: ChapterFilter): Prisma.ChapterWhereInput {
    const where: Prisma.ChapterWhereInput = {};
    if (filter.comicId !== undefined) where.comicId = toPrimaryKey(filter.comicId);
    if (filter.teamId !== undefined) where.teamId = toPrimaryKey(filter.teamId);
    if (filter.status) where.status = filter.status;
    return where;
  }

  findMany(filter: ChapterFilter, options: { skip: number; take: number }) {
    return this.prisma.chapter.findMany({
      where: this.buildWhere(filter),
      include: WITH_PAGES,
      orderBy: { chapterIndex: 'desc' },
      skip: options.skip,
      take: options.take,
    });
  }

  findSimpleMany(filter: ChapterFilter, take: number) {
    return this.prisma.chapter.findMany({
      where: this.buildWhere(filter),
      select: SIMPLE_SELECT,
      orderBy: { chapterIndex: 'desc' },
      take,
    });
  }

  count(filter: ChapterFilter) {
    return this.prisma.chapter.count({ where: this.buildWhere(filter) });
  }

  findById(id: any) {
    return this.prisma.chapter.findUnique({
      where: { id: toPrimaryKey(id) },
      include: WITH_PAGES,
    });
  }

  findByIndex(comicId: any, chapterIndex: number) {
    return this.prisma.chapter.findUnique({
      where: {
        comicId_chapterIndex: {
          comicId: toPrimaryKey(comicId),
          chapterIndex: chapterIndex,
        },
      },
    });
  }

  findPublicOne(id: any) {
    return this.prisma.chapter.findFirst({
      where: { id: toPrimaryKey(id), status: ChapterStatus.published },
      include: {
        pages: { orderBy: { pageNumber: 'asc' } },
        comic: { select: { id: true, title: true, slug: true } },
      },
    });
  }

  findPages(chapterId: any) {
    return this.prisma.page.findMany({
      where: { chapterId: toPrimaryKey(chapterId) },
      orderBy: { pageNumber: 'asc' },
    });
  }

  findPublishedNeighbor(comicId: any, currentIndex: number, direction: 'next' | 'prev') {
    return this.prisma.chapter.findFirst({
      where: {
        comicId: toPrimaryKey(comicId),
        chapterIndex: direction === 'next' ? { gt: currentIndex } : { lt: currentIndex },
        status: ChapterStatus.published,
      },
      orderBy: { chapterIndex: direction === 'next' ? 'asc' : 'desc' },
      select: { id: true, title: true, chapterIndex: true, chapterLabel: true },
    });
  }

  create(data: Record<string, any>) {
    return this.prisma.chapter.create({
      data: this.normalizePayload(data) as Prisma.ChapterUncheckedCreateInput,
    });
  }

  createPages(pages: Prisma.PageCreateManyInput[]) {
    return this.prisma.page.createMany({ data: pages });
  }

  deletePages(chapterId: any) {
    return this.prisma.page.deleteMany({ where: { chapterId: toPrimaryKey(chapterId) } });
  }

  update(id: any, data: Record<string, any>) {
    return this.prisma.chapter.update({
      where: { id: toPrimaryKey(id) },
      data: this.normalizePayload(data) as Prisma.ChapterUncheckedUpdateInput,
    });
  }

  delete(id: any) {
    return this.prisma.chapter.delete({ where: { id: toPrimaryKey(id) } });
  }

  /**
   * Update `lastChapterId` only when the new chapter is genuinely the
   * latest. Without the `chapterIndex` guard, re-publishing an old chapter
   * (e.g. fixing typos in chapter 1) overwrote the pointer with the wrong
   * chapter and the homepage "latest update" went backwards.
   */
  async updateComicLastChapter(comicId: any, chapterId: any) {
    const cid = toPrimaryKey(comicId);
    const chid = toPrimaryKey(chapterId);
    const chapter = await this.prisma.chapter.findUnique({
      where: { id: chid },
      select: { chapterIndex: true },
    });
    if (!chapter) return null;

    const max = await this.prisma.chapter.aggregate({
      where: { comicId: cid, status: ChapterStatus.published },
      _max: { chapterIndex: true },
    });

    const isLatest =
      max._max.chapterIndex == null ||
      chapter.chapterIndex >= max._max.chapterIndex;
    if (!isLatest) return null;

    return this.prisma.comic.update({
      where: { id: cid },
      data: { lastChapterId: chid, lastChapterUpdatedAt: new Date() },
    });
  }

  /**
   * Check if the given chapter is the latest published and, if so, update
   * the comic's last_chapter pointer. Accepts an optional transaction client.
   */
  async updateComicLastChapterIfLatest(
    comicId: any,
    chapterId: any,
    chapterIndex: number,
    tx?: Tx,
  ) {
    const client = tx ?? this.prisma;
    const cid = toPrimaryKey(comicId);
    const chid = toPrimaryKey(chapterId);

    const max = await client.chapter.aggregate({
      where: { comicId: cid, status: ChapterStatus.published },
      _max: { chapterIndex: true },
    });

    const isLatest =
      max._max.chapterIndex == null ||
      chapterIndex >= max._max.chapterIndex;
    if (!isLatest) return null;

    return client.comic.update({
      where: { id: cid },
      data: { lastChapterId: chid, lastChapterUpdatedAt: new Date() },
    });
  }

  findComicBasic(comicId: any, tx?: Tx) {
    const client = tx ?? this.prisma;
    return client.comic.findUnique({
      where: { id: toPrimaryKey(comicId) },
      select: { id: true, title: true, slug: true },
    });
  }

  createOutbox(eventType: string, payload: Record<string, any>, tx?: Tx) {
    const client = tx ?? this.prisma;
    return client.outbox.create({ data: { eventType, payload } });
  }

  async withTransaction<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(fn);
  }

  private normalizePayload(data: Record<string, any>): Record<string, any> {
    const payload: Record<string, any> = {};
    for (const key of Object.keys(data)) {
      if (ALLOWED_FIELDS.has(key)) payload[key] = data[key];
    }
    const bigIntFields = ['comicId', 'teamId', 'createdUserId', 'updatedUserId'];
    for (const field of bigIntFields) {
      const value = payload[field];
      if (value === undefined) continue;
      payload[field] = value === null || value === '' ? null : toPrimaryKey(value);
    }
    return payload;
  }
}
