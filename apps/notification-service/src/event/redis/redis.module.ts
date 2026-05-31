import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { RedisClientModule } from '@package/redis-client';
import { NotificationModule } from '../../modules/notification/notification.module';
import { QueueModule } from '../../queue/queue.module';
import { ChapterPublishedHandler } from '../kafka/handlers/chapter-published.handler';
import { CommentCreatedHandler } from '../kafka/handlers/comment-created.handler';
import { UserFollowedHandler } from '../kafka/handlers/user-followed.handler';
import { UserUnfollowedHandler } from '../kafka/handlers/user-unfollowed.handler';
import { UserRegisteredHandler } from '../kafka/handlers/user-registered.handler';
import { PasswordResetHandler } from '../kafka/handlers/password-reset.handler';
import { ContactSubmittedHandler } from '../kafka/handlers/contact-submitted.handler';
import { PostCommentCreatedHandler } from '../kafka/handlers/post-comment-created.handler';
import { MailSendHandler } from '../kafka/handlers/mail-send.handler';
import { RedisNotificationConsumerService } from './redis-consumer.service';

@Module({
  imports: [
    RedisClientModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        url: config.get<string>('REDIS_EVENT_URL', 'redis://localhost:6380'),
        groupName: config.get<string>('kafka.groupId', 'notification-service'),
        streamMaxLen: config.get<number>('REDIS_STREAM_MAX_LEN', 10_000),
      }),
      inject: [ConfigService],
    }),
    NotificationModule,
    QueueModule,
  ],
  providers: [
    ChapterPublishedHandler,
    CommentCreatedHandler,
    UserFollowedHandler,
    UserUnfollowedHandler,
    UserRegisteredHandler,
    PasswordResetHandler,
    ContactSubmittedHandler,
    PostCommentCreatedHandler,
    MailSendHandler,
    RedisNotificationConsumerService,
  ],
})
export class RedisEventModule {}
