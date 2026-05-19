import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { RabbitmqClientModule } from '@package/rabbitmq-client';
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
import { RabbitmqConsumerService } from './rabbitmq-consumer.service';

@Module({
  imports: [
    RabbitmqClientModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        uri: config.get<string>('RABBITMQ_URL', 'amqp://localhost:5672'),
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
    RabbitmqConsumerService,
  ],
})
export class RabbitmqModule {}
