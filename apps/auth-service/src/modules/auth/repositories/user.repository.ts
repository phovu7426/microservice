import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from 'src/generated/prisma';
import { PrismaService } from '../../../core/database/prisma.service';
import { PrimaryKey } from 'src/types';

type Tx = Prisma.TransactionClient | PrismaService;

@Injectable()
export class UserRepository {
  private readonly logger = new Logger(UserRepository.name);

  constructor(private readonly prisma: PrismaService) {}

  findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  findByEmailWithProfile(email: string) {
    return this.prisma.user.findUnique({ where: { email }, include: { profile: true } });
  }

  findById(id: PrimaryKey) {
    return this.prisma.user.findUnique({ where: { id }, include: { profile: true } });
  }

  findByEmailSelect(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, status: true, password: true },
    });
  }

  findByUsername(username: string) {
    return this.prisma.user.findUnique({ where: { username } });
  }

  findByPhone(phone: string) {
    return this.prisma.user.findUnique({ where: { phone } });
  }

  create(data: Record<string, any>, tx: Tx = this.prisma) {
    return tx.user.create({ data: data as Prisma.UserCreateInput });
  }

  update(id: PrimaryKey, data: Record<string, any>, tx: Tx = this.prisma) {
    return tx.user.update({ where: { id }, data: data as Prisma.UserUpdateInput });
  }

  updateLastLogin(id: PrimaryKey) {
    return this.prisma.user
      .update({ where: { id }, data: { lastLoginAt: new Date() } })
      .catch((err) => {
        this.logger.warn(`updateLastLogin failed for user ${id}: ${(err as Error).message}`);
        return undefined;
      });
  }

  /** Insert an outbox event — call within a transaction. */
  enqueueOutboxEvent(
    eventType: string,
    payload: Record<string, unknown>,
    tx: Tx = this.prisma,
  ) {
    return tx.outbox.create({
      data: {
        eventType: eventType,
        payload: payload as any,
      },
    });
  }

  /** Run multiple repo operations in a single transaction. */
  async withTransaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(fn);
  }
}
