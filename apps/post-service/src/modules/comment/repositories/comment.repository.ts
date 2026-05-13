import { Injectable } from '@nestjs/common';
import { Prisma } from 'src/generated/prisma';
import { PrimaryKey, toPrimaryKey } from 'src/types';
import { PrismaService } from '../../../core/database/prisma.service';
import { CommentStatus } from '../enums/comment-status.enum';

type Tx = Prisma.TransactionClient | PrismaService;

export interface CommentFilter {
  postId?: any;
  parentId?: any;
  status?: string;
  userId?: any;
}

const ALLOWED_FIELDS: ReadonlySet<string> = new Set([
  'postId', 'parentId', 'userId', 'content', 'status',
  'guestName', 'guestEmail',
  'createdUserId', 'updatedUserId',
]);

const SORTABLE_FIELDS: ReadonlySet<string> = new Set([
  'createdAt',
  'updatedAt',
]);

@Injectable()
export class CommentRepository {
  constructor(private readonly prisma: PrismaService) {}

  private buildWhere(filter: CommentFilter): Prisma.CommentWhereInput {
    const where: Prisma.CommentWhereInput = {};
    if (filter.postId !== undefined) where.postId = toPrimaryKey(filter.postId);
    if (filter.userId !== undefined) where.userId = toPrimaryKey(filter.userId);
    if (filter.status) where.status = filter.status;
    if (filter.parentId !== undefined) {
      where.parentId = filter.parentId === null ? null : toPrimaryKey(filter.parentId);
    }
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
        replies: {
          where: { status: CommentStatus.visible },
          orderBy: { createdAt: 'asc' },
          // Cap replies per parent so a hot thread can't return megabytes
          // per request (the include used to be unbounded).
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

  /**
   * Checks whether a post with the given id exists and is in one of the
   * supplied public statuses.
   */
  existsPublicPost(postId: PrimaryKey, statuses: string[]) {
    return this.prisma.post.findFirst({
      where: { id: postId, status: { in: statuses } },
      select: { id: true, status: true },
    });
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
    const payload: Record<string, any> = {};
    for (const key of Object.keys(data)) {
      if (ALLOWED_FIELDS.has(key)) payload[key] = data[key];
    }
    const bigIntFields = ['postId', 'parentId', 'userId', 'createdUserId', 'updatedUserId'];
    for (const field of bigIntFields) {
      const value = payload[field];
      if (value === undefined) continue;
      payload[field] = value === null || value === '' ? null : toPrimaryKey(value);
    }
    return payload;
  }
}
