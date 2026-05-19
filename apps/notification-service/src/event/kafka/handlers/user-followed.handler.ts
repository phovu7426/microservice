import { Injectable } from '@nestjs/common';
import { FollowersProjectionRepository } from '../../../modules/notification/repositories/followers-projection.repository';
import { KafkaHandler } from '../interfaces/kafka-handler.interface';

@Injectable()
export class UserFollowedHandler implements KafkaHandler {
  constructor(private readonly followersProjectionRepo: FollowersProjectionRepository) {}

  async handle(payload: any) {
    const { user_id, comic_id, followed_at } = payload;
    await this.followersProjectionRepo.upsert(
      BigInt(user_id),
      BigInt(comic_id),
      followed_at ? new Date(followed_at) : new Date(),
    );
  }
}
