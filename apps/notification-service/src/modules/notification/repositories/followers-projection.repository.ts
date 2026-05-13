import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';

@Injectable()
export class FollowersProjectionRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByComicId(comicId: bigint) {
    return this.prisma.comicFollowersProjection.findMany({
      where: { comicId },
      select: { userId: true },
    });
  }

  upsert(userId: bigint, comicId: bigint, followedAt: Date) {
    return this.prisma.comicFollowersProjection.upsert({
      where: { userId_comicId: { userId, comicId } },
      create: { userId, comicId, followedAt },
      update: {},
    });
  }

  deleteMany(userId: bigint, comicId: bigint) {
    return this.prisma.comicFollowersProjection.deleteMany({
      where: { userId, comicId },
    });
  }
}
