import { Injectable } from '@nestjs/common';
import { Prisma } from 'src/generated/prisma';
import { toPrimaryKey } from 'src/types';
import { PrismaService } from '../../../core/database/prisma.service';

export interface ReviewFilter {
  comicId?: any;
  userId?: any;
  rating?: number;
}

@Injectable()
export class ReviewRepository {
  constructor(private readonly prisma: PrismaService) {}

  private buildWhere(filter: ReviewFilter): Prisma.ReviewWhereInput {
    const where: Prisma.ReviewWhereInput = {};
    if (filter.comicId !== undefined) where.comicId = toPrimaryKey(filter.comicId);
    if (filter.userId !== undefined) where.userId = toPrimaryKey(filter.userId);
    if (filter.rating !== undefined) where.rating = filter.rating;
    return where;
  }

  findMany(filter: ReviewFilter, options: { skip: number; take: number }) {
    return this.prisma.review.findMany({
      where: this.buildWhere(filter),
      orderBy: { createdAt: 'desc' },
      skip: options.skip,
      take: options.take,
    });
  }

  count(filter: ReviewFilter) {
    return this.prisma.review.count({ where: this.buildWhere(filter) });
  }

  findById(id: any) {
    return this.prisma.review.findUnique({ where: { id: toPrimaryKey(id) } });
  }

  /**
   * Atomic upsert + counter delta in one transaction. Two concurrent rate
   * calls on the same comic used to both read the same baseline aggregate
   * (read-then-write) and overwrite each other's count. Atomic deltas via
   * Prisma `increment`/`decrement` eliminate that drift.
   */
  upsert(userId: any, comicId: any, data: { rating: number; content?: string }) {
    const uid = toPrimaryKey(userId);
    const cid = toPrimaryKey(comicId);
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.review.findUnique({
        where: { userId_comicId: { userId: uid, comicId: cid } },
        select: { rating: true },
      });

      const review = await tx.review.upsert({
        where: { userId_comicId: { userId: uid, comicId: cid } },
        create: { userId: uid, comicId: cid, rating: data.rating, content: data.content },
        update: { rating: data.rating, content: data.content },
      });

      if (existing) {
        const delta = data.rating - existing.rating;
        if (delta !== 0) {
          await tx.stats.upsert({
            where: { comicId: cid },
            create: { comicId: cid, ratingSum: BigInt(data.rating), ratingCount: BigInt(1) },
            update: { ratingSum: { increment: delta } },
          });
        }
      } else {
        await tx.stats.upsert({
          where: { comicId: cid },
          create: { comicId: cid, ratingSum: BigInt(data.rating), ratingCount: BigInt(1) },
          update: {
            ratingSum: { increment: data.rating },
            ratingCount: { increment: 1 },
          },
        });
      }

      return review;
    });
  }

  /** Hard-delete with atomic counter decrement, all in one transaction. */
  async deleteWithStats(id: any) {
    const rid = toPrimaryKey(id);
    return this.prisma.$transaction(async (tx) => {
      const review = await tx.review.findUnique({
        where: { id: rid },
        select: { id: true, comicId: true, rating: true },
      });
      if (!review) return null;
      await tx.review.delete({ where: { id: rid } });
      await tx.stats.upsert({
        where: { comicId: review.comicId },
        create: { comicId: review.comicId, ratingSum: BigInt(0), ratingCount: BigInt(0) },
        update: {
          ratingSum: { decrement: review.rating },
          ratingCount: { decrement: 1 },
        },
      });
      return review;
    });
  }

  delete(id: any) {
    return this.prisma.review.delete({ where: { id: toPrimaryKey(id) } });
  }

  aggregateRating(comicId: any) {
    return this.prisma.review.aggregate({
      where: { comicId: toPrimaryKey(comicId) },
      _count: true,
      _sum: { rating: true },
    });
  }

  aggregateRatingForFilter(filter: ReviewFilter) {
    return this.prisma.review.aggregate({
      where: this.buildWhere(filter),
      _avg: { rating: true },
      _count: true,
    });
  }

  /**
   * Recompute ratingSum / ratingCount from scratch. Live writes use
   * atomic deltas via `upsert` / `deleteWithStats`; this method is for
   * offline migrations / drift recovery only.
   */
  async syncRatingStats(comicId: any) {
    const cid = toPrimaryKey(comicId);
    return this.prisma.$transaction(async (tx) => {
      const agg = await tx.review.aggregate({
        where: { comicId: cid },
        _count: true,
        _sum: { rating: true },
      });
      return tx.stats.upsert({
        where: { comicId: cid },
        create: {
          comicId: cid,
          ratingCount: BigInt(agg._count || 0),
          ratingSum: BigInt(agg._sum?.rating || 0),
        },
        update: {
          ratingCount: BigInt(agg._count || 0),
          ratingSum: BigInt(agg._sum?.rating || 0),
        },
      });
    });
  }
}
