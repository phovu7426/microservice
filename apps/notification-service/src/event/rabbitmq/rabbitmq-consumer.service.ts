import { Injectable } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { RabbitSubscribe, MessageHandlerErrorBehavior } from '@golevelup/nestjs-rabbitmq';
import { IdempotencyService } from '@package/common';
import { KafkaHandler } from '../kafka/interfaces/kafka-handler.interface';
import { ChapterPublishedHandler } from '../kafka/handlers/chapter-published.handler';
import { CommentCreatedHandler } from '../kafka/handlers/comment-created.handler';
import { UserFollowedHandler } from '../kafka/handlers/user-followed.handler';
import { UserUnfollowedHandler } from '../kafka/handlers/user-unfollowed.handler';
import { UserRegisteredHandler } from '../kafka/handlers/user-registered.handler';
import { PasswordResetHandler } from '../kafka/handlers/password-reset.handler';
import { ContactSubmittedHandler } from '../kafka/handlers/contact-submitted.handler';
import { PostCommentCreatedHandler } from '../kafka/handlers/post-comment-created.handler';
import { MailSendHandler } from '../kafka/handlers/mail-send.handler';

const EXCHANGE = 'events';
const DLX = 'events.dlq';
const queueOptions = { durable: true, deadLetterExchange: DLX };
const errorBehavior = MessageHandlerErrorBehavior.NACK;

@SkipThrottle()
@Injectable()
export class RabbitmqConsumerService {
  constructor(
    private readonly idempotency: IdempotencyService,
    private readonly chapterPublished: ChapterPublishedHandler,
    private readonly commentCreated: CommentCreatedHandler,
    private readonly userFollowed: UserFollowedHandler,
    private readonly userUnfollowed: UserUnfollowedHandler,
    private readonly userRegistered: UserRegisteredHandler,
    private readonly passwordReset: PasswordResetHandler,
    private readonly contactSubmitted: ContactSubmittedHandler,
    private readonly postCommentCreated: PostCommentCreatedHandler,
    private readonly mailSend: MailSendHandler,
  ) {}

  private async dispatch(routingKey: string, payload: any, handler: KafkaHandler): Promise<void> {
    const eventId =
      payload?.id?.toString() ?? payload?.event_id?.toString() ?? String(Date.now());
    const claimed = await this.idempotency.claim(routingKey, eventId);
    if (!claimed) return;
    try {
      await handler.handle(payload);
    } catch (err) {
      await this.idempotency.release(routingKey, eventId);
      throw err;
    }
  }

  @RabbitSubscribe({ exchange: EXCHANGE, routingKey: 'comic.chapter.published', queue: 'comic.chapter.published', queueOptions, errorBehavior })
  async onChapterPublished(payload: any): Promise<void> {
    await this.dispatch('comic.chapter.published', payload, this.chapterPublished);
  }

  @RabbitSubscribe({ exchange: EXCHANGE, routingKey: 'comic.comment.created', queue: 'comic.comment.created', queueOptions, errorBehavior })
  async onCommentCreated(payload: any): Promise<void> {
    await this.dispatch('comic.comment.created', payload, this.commentCreated);
  }

  @RabbitSubscribe({ exchange: EXCHANGE, routingKey: 'user.followed.comic', queue: 'user.followed.comic', queueOptions, errorBehavior })
  async onUserFollowed(payload: any): Promise<void> {
    await this.dispatch('user.followed.comic', payload, this.userFollowed);
  }

  @RabbitSubscribe({ exchange: EXCHANGE, routingKey: 'user.unfollowed.comic', queue: 'user.unfollowed.comic', queueOptions, errorBehavior })
  async onUserUnfollowed(payload: any): Promise<void> {
    await this.dispatch('user.unfollowed.comic', payload, this.userUnfollowed);
  }

  @RabbitSubscribe({ exchange: EXCHANGE, routingKey: 'user.registered', queue: 'user.registered', queueOptions, errorBehavior })
  async onUserRegistered(payload: any): Promise<void> {
    await this.dispatch('user.registered', payload, this.userRegistered);
  }

  @RabbitSubscribe({ exchange: EXCHANGE, routingKey: 'user.password.reset', queue: 'user.password.reset', queueOptions, errorBehavior })
  async onPasswordReset(payload: any): Promise<void> {
    await this.dispatch('user.password.reset', payload, this.passwordReset);
  }

  @RabbitSubscribe({ exchange: EXCHANGE, routingKey: 'contact.submitted', queue: 'contact.submitted', queueOptions, errorBehavior })
  async onContactSubmitted(payload: any): Promise<void> {
    await this.dispatch('contact.submitted', payload, this.contactSubmitted);
  }

  @RabbitSubscribe({ exchange: EXCHANGE, routingKey: 'post.comment.created', queue: 'post.comment.created', queueOptions, errorBehavior })
  async onPostCommentCreated(payload: any): Promise<void> {
    await this.dispatch('post.comment.created', payload, this.postCommentCreated);
  }

  @RabbitSubscribe({ exchange: EXCHANGE, routingKey: 'mail.send', queue: 'mail.send', queueOptions, errorBehavior })
  async onMailSend(payload: any): Promise<void> {
    await this.dispatch('mail.send', payload, this.mailSend);
  }
}
