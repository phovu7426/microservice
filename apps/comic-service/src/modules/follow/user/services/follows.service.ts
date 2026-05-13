import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrimaryKey } from 'src/types';
import { ConfigService } from '@nestjs/config';
import { I18nService } from 'nestjs-i18n';
import { t, createPaginationMeta, parseQueryOptions } from '@package/common';
import { FollowFilter, FollowRepository } from '../../repositories/follow.repository';

@Injectable()
export class UserFollowService {
  constructor(
    private readonly followRepo: FollowRepository,
    private readonly i18n: I18nService,
    private readonly config: ConfigService,
  ) {}

  async getList(userId: PrimaryKey, query: any = {}) {
    const options = parseQueryOptions(query);

    const filter: FollowFilter = { userId: userId };

    const [data, total] = await Promise.all([
      this.followRepo.findMany(filter, options),
      this.followRepo.count(filter),
    ]);

    return { data, meta: createPaginationMeta(options, total) };
  }

  async follow(userId: PrimaryKey, comicId: PrimaryKey) {
    const kafkaEnabled = !!this.config.get<boolean>('kafka.enabled');

    return this.followRepo.withTransaction(async (tx) => {
      const existing = await this.followRepo.findUnique(userId, comicId, tx);
      if (existing) throw new ConflictException(t(this.i18n, 'comic.ALREADY_FOLLOWING'));

      const follow = await this.followRepo.create(userId, comicId, tx);
      await this.followRepo.incrementFollowCount(comicId, tx);

      if (kafkaEnabled) {
        await this.followRepo.createOutbox(
          'user.followed.comic',
          {
            user_id: String(userId),
            comic_id: String(comicId),
            followed_at: new Date().toISOString(),
          },
          tx,
        );
      }

      return follow;
    });
  }

  async unfollow(userId: PrimaryKey, comicId: PrimaryKey) {
    const kafkaEnabled = !!this.config.get<boolean>('kafka.enabled');

    return this.followRepo.withTransaction(async (tx) => {
      const existing = await this.followRepo.findUnique(userId, comicId, tx);
      if (!existing) throw new NotFoundException(t(this.i18n, 'comic.NOT_FOLLOWING'));

      await this.followRepo.delete(userId, comicId, tx);
      await this.followRepo.decrementFollowCount(comicId, tx);

      if (kafkaEnabled) {
        await this.followRepo.createOutbox(
          'user.unfollowed.comic',
          {
            user_id: String(userId),
            comic_id: String(comicId),
          },
          tx,
        );
      }

      return { success: true };
    });
  }
}
