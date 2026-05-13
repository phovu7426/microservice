import { Injectable } from '@nestjs/common';
import { Prisma } from 'src/generated/prisma';
import { toPrimaryKey } from 'src/types';
import { PrismaService } from '../../../core/database/prisma.service';
import { CommentStatus } from '../enums/comment-status.enum';
import { ChapterStatus } from '../../chapter/enums/chapter-status.enum';

type Tx = Prisma.TransactionClient | PrismaService;

export interface CommentFilter {
  comicId?: any;
  chapterId?: any;
  parentId?: any;
  status?: string;
  userId?: any;
}

@Injectable()
export class CommentRepository {
  constructor(private readonly prisma: PrismaService) {}

  private buildWhere(filter: CommentFilter): Prisma.CommentWhereInput {
    const where: Prisma.CommentWhereInput = {};
    if (filter.comicId !== undefined) where.comicId = toPrimaryKey(filter.comicId);
    if (filter.userId !== undefined) where.userId = toPrimaryKey(filter.userId);
    if (filter.chapterId !== undefined) {
      where.chapterId = filter.chapterId === null ? null : toPrimaryKey(filter.chapterId);
    }
    if (filter.parentId !== undefined) {
      where.parentId = filter.parentId === null ? null : toPrimaryKey(filter.parentId);
    }
    if (filter.status) where.status = filter.status;
    return where;
  }

  findMany(filter: CommentFilter, options: { skip: number; take: number }) {
    return this.prisma.comment.findMany({
      where: this.buildWhere(filter),
      orderBy: { createdAt: 'desc' },
      skip: options.skip,
      take: options.take,
    });
  }

  findManyWithReplies(filter: CommentFilter, options: { skip: number; take: number }) {
    return this.prisma.comment.findMany({
      where: this.buildWhere(filter),
      include: {
        // Cap replies per parent — hot threads with thousands of replies
        // would otherwise return megabytes per request.
        replies: {
          where: { status: CommentStatus.visible },
          orderBy: { createdAt: 'asc' },
          take: 50,
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: options.skip,
      take: options.take,
    });
  }

  count(filter: CommentFilter) {
    return this.prisma.comment.count({ where: this.buildWhere(filter) });
  }

  findById(id: any) {
    return this.prisma.comment.findUnique({ where: { id: toPrimaryKey(id) } });
  }

  create(data: Record<string, any>, tx?: Tx) {
    const client = tx ?? this.prisma;
    return client.comment.create({
      data: this.normalizePayload(data) as Prisma.CommentUncheckedCreateInput,
    });
  }

  createOutbox(eventType: string, payload: Record<string, any>, tx?: Tx) {
    const client = tx ?? this.prisma;
    return client.outbox.create({ data: { eventType, payload } });
  }

  async withTransaction<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(fn);
  }

  existsPublicComic(comicId: any, statuses: string[]) {
    return this.prisma.comic.findFirst({
      where: { id: toPrimaryKey(comicId), status: { in: statuses } },
      select: { id: true },
    });
  }

  existsPublishedChapter(chapterId: any, comicId: any) {
    return this.prisma.chapter.findFirst({
      where: { id: toPrimaryKey(chapterId), comicId: toPrimaryKey(comicId), status: ChapterStatus.published },
      select: { id: true },
    });
  }

  update(id: any, data: Record<string, any>) {
    return this.prisma.comment.update({
      where: { id: toPrimaryKey(id) },
      data: this.normalizePayload(data) as Prisma.CommentUncheckedUpdateInput,
    });
  }

  delete(id: any) {
    return this.prisma.comment.delete({ where: { id: toPrimaryKey(id) } });
  }

  private normalizePayload(data: Record<string, any>): Record<string, any> {
    // Strict allowlist — defense-in-depth against mass-assignment via spread.
    const ALLOWED: ReadonlySet<string> = new Set([
      'userId', 'comicId', 'chapterId', 'parentId', 'content', 'status',
    ]);
    const payload: Record<string, any> = {};
    for (const key of Object.keys(data)) {
      if (ALLOWED.has(key)) payload[key] = data[key];
    }
    const bigIntFields = ['userId', 'comicId', 'chapterId', 'parentId'];
    for (const field of bigIntFields) {
      const value = payload[field];
      if (value === undefined) continue;
      payload[field] = value === null || value === '' ? null : toPrimaryKey(value);
    }
    return payload;
  }
}
