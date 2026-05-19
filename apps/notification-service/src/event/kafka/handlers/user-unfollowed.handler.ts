import { Injectable } from '@nestjs/common';
import { FollowersProjectionRepository } from '../../../modules/notification/repositories/followers-projection.repository';
import { KafkaHandler } from '../interfaces/kafka-handler.interface';

@Injectable()
export class UserUnfollowedHandler implements KafkaHandler {
  constructor(private readonly followersProjectionRepo: FollowersProjectionRepository) {}

  async handle(payload: any) {
    const { user_id, comic_id } = payload;
    await this.followersProjectionRepo.deleteMany(BigInt(user_id), BigInt(comic_id));
  }
}
