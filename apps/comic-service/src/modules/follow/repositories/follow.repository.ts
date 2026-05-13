import { Injectable } from '@nestjs/common';
import { Prisma } from 'src/generated/prisma';
import { toPrimaryKey } from 'src/types';
import { PrismaService } from '../../../core/database/prisma.service';

type Tx = Prisma.TransactionClient | PrismaService;

export interface FollowFilter {
  userId?: any;
  comicId?: any;
}

@Injectable()
export class FollowRepository {
  constructor(private readonly prisma: PrismaService) {}

  private buildWhere(filter: FollowFilter): Prisma.FollowWhereInput {
    const where: Prisma.FollowWhereInput = {};
    if (filter.userId !== undefined) where.userId = toPrimaryKey(filter.userId);
    if (filter.comicId !== undefined) where.comicId = toPrimaryKey(filter.comicId);
    return where;
  }

  findMany(filter: FollowFilter, options: { skip: number; take: number }) {
    return this.prisma.follow.findMany({
      where: this.buildWhere(filter),
      include: {
        comic: { select: { id: true, title: true, slug: true, coverImage: true, stats: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: options.skip,
      take: options.take,
    });
  }

  count(filter: FollowFilter) {
    return this.prisma.follow.count({ where: this.buildWhere(filter) });
  }

  findUnique(userId: any, comicId: any, tx?: Tx) {
    const client = tx ?? this.prisma;
    return client.follow.findUnique({
      where: { userId_comicId: { userId: toPrimaryKey(userId), comicId: toPrimaryKey(comicId) } },
    });
  }

  create(userId: any, comicId: any, tx?: Tx) {
    const client = tx ?? this.prisma;
    return client.follow.create({
      data: { userId: toPrimaryKey(userId), comicId: toPrimaryKey(comicId) },
    });
  }

  delete(userId: any, comicId: any, tx?: Tx) {
    const client = tx ?? this.prisma;
    return client.follow.delete({
      where: { userId_comicId: { userId: toPrimaryKey(userId), comicId: toPrimaryKey(comicId) } },
    });
  }

  incrementFollowCount(comicId: any, tx?: Tx) {
    const client = tx ?? this.prisma;
    const cid = toPrimaryKey(comicId);
    return client.stats.upsert({
      where: { comicId: cid },
      create: { comicId: cid, followCount: BigInt(1) },
      update: { followCount: { increment: 1 } },
    });
  }

  decrementFollowCount(comicId: any, tx?: Tx) {
    const client = tx ?? this.prisma;
    const cid = toPrimaryKey(comicId);
    return client.stats.upsert({
      where: { comicId: cid },
      create: { comicId: cid, followCount: BigInt(0) },
      update: { followCount: { decrement: 1 } },
    });
  }

  async syncFollowCount(comicId: any) {
    const cid = toPrimaryKey(comicId);
    const count = await this.prisma.follow.count({ where: { comicId: cid } });
    return this.prisma.stats.upsert({
      where: { comicId: cid },
      create: { comicId: cid, followCount: BigInt(count) },
      update: { followCount: BigInt(count) },
    });
  }

  createOutbox(eventType: string, payload: Record<string, any>, tx?: Tx) {
    const client = tx ?? this.prisma;
    return client.outbox.create({ data: { eventType, payload } });
  }

  async withTransaction<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(fn);
  }
}
