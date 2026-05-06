import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';

@Injectable()
export class FollowersProjectionRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByComicId(comicId: bigint) {
    return this.prisma.comicFollowersProjection.findMany({
      where: { comic_id: comicId },
      select: { user_id: true },
    });
  }

  upsert(userId: bigint, comicId: bigint, followedAt: Date) {
    return this.prisma.comicFollowersProjection.upsert({
      where: { user_id_comic_id: { user_id: userId, comic_id: comicId } },
      create: { user_id: userId, comic_id: comicId, followed_at: followedAt },
      update: {},
    });
  }

  deleteMany(userId: bigint, comicId: bigint) {
    return this.prisma.comicFollowersProjection.deleteMany({
      where: { user_id: userId, comic_id: comicId },
    });
  }
}
