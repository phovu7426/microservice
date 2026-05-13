import { Injectable } from '@nestjs/common';
import { Prisma } from 'src/generated/prisma';
import { PrismaService } from '../../../core/database/prisma.service';
import { PrimaryKey } from 'src/types';

export interface NotificationFilter {
  id?: PrimaryKey;
  userId?: string;
  type?: string;
  status?: string;
  isRead?: boolean;
}

export interface CreateNotificationData {
  userId: string | PrimaryKey;
  title: string;
  message: string;
  type?: string;
  data?: any;
  status?: string;
}

export interface FindManyOptions {
  skip: number;
  take: number;
  sortBy?: string;
  order?: 'asc' | 'desc';
}

@Injectable()
export class NotificationRepository {
  constructor(private readonly prisma: PrismaService) {}

  private buildWhere(filter: NotificationFilter): Prisma.NotificationWhereInput {
    const where: Prisma.NotificationWhereInput = {};
    if (filter.id !== undefined) where.id = filter.id;
    if (filter.userId !== undefined) {
      // BigInt(non-numeric) throws SyntaxError → 500. Validate the input
      // before conversion and surface bad values as a 400 at the service layer.
      if (!/^\d{1,20}$/.test(String(filter.userId))) {
        throw new Error('user_id must be a positive integer');
      }
      where.userId = BigInt(filter.userId);
    }
    if (filter.type !== undefined) where.type = filter.type;
    if (filter.status !== undefined) where.status = filter.status;
    if (filter.isRead !== undefined) where.isRead = filter.isRead;
    return where;
  }

  private buildOrderBy(sortBy?: string, order?: 'asc' | 'desc'): Prisma.NotificationOrderByWithRelationInput {
    if (sortBy) return { [sortBy]: order ?? 'desc' };
    return { createdAt: 'desc' };
  }

  findMany(filter: NotificationFilter, options: FindManyOptions) {
    return this.prisma.notification.findMany({
      where: this.buildWhere(filter),
      orderBy: this.buildOrderBy(options.sortBy, options.order),
      skip: options.skip,
      take: options.take,
    });
  }

  count(filter: NotificationFilter) {
    return this.prisma.notification.count({ where: this.buildWhere(filter) });
  }

  findById(id: PrimaryKey) {
    return this.prisma.notification.findUnique({ where: { id } });
  }

  findFirst(filter: NotificationFilter) {
    return this.prisma.notification.findFirst({ where: this.buildWhere(filter) });
  }

  create(data: CreateNotificationData) {
    return this.prisma.notification.create({
      data: { ...data, userId: BigInt(data.userId) },
    });
  }

  async createMany(data: CreateNotificationData[]) {
    const BATCH_SIZE = 500;
    let totalCount = 0;
    for (let i = 0; i < data.length; i += BATCH_SIZE) {
      const batch = data.slice(i, i + BATCH_SIZE).map((d) => ({ ...d, userId: BigInt(d.userId) }));
      const result = await this.prisma.notification.createMany({
        data: batch,
        skipDuplicates: true,
      });
      totalCount += result.count;
    }
    return { count: totalCount };
  }

  update(id: PrimaryKey, data: Prisma.NotificationUpdateInput) {
    return this.prisma.notification.update({ where: { id }, data });
  }

  updateMany(filter: NotificationFilter, data: Prisma.NotificationUpdateInput) {
    return this.prisma.notification.updateMany({ where: this.buildWhere(filter), data });
  }

  delete(id: PrimaryKey) {
    return this.prisma.notification.delete({ where: { id } });
  }
}
