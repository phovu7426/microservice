import { Module } from '@nestjs/common';
import { KafkaService } from './services/kafka.service';
import { NotificationModule } from '../../modules/notification/notification.module';
import { QueueModule } from '../../queue/queue.module';
import { ChapterPublishedHandler } from './handlers/chapter-published.handler';
import { CommentCreatedHandler } from './handlers/comment-created.handler';
import { UserFollowedHandler } from './handlers/user-followed.handler';
import { UserUnfollowedHandler } from './handlers/user-unfollowed.handler';
import { UserRegisteredHandler } from './handlers/user-registered.handler';
import { PasswordResetHandler } from './handlers/password-reset.handler';
import { ContactSubmittedHandler } from './handlers/contact-submitted.handler';
import { PostCommentCreatedHandler } from './handlers/post-comment-created.handler';
import { MailSendHandler } from './handlers/mail-send.handler';

@Module({
  imports: [NotificationModule, QueueModule],
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
    KafkaService,
  ],
})
export class KafkaModule {}
