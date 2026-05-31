import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisConsumerService, RedisClientOptions } from '@package/redis-client';
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

@Injectable()
export class RedisNotificationConsumerService extends RedisConsumerService {
  private readonly handlers: Map<string, KafkaHandler>;

  constructor(
    config: ConfigService,
    private readonly idempotency: IdempotencyService,
    chapterPublished: ChapterPublishedHandler,
    commentCreated: CommentCreatedHandler,
    userFollowed: UserFollowedHandler,
    userUnfollowed: UserUnfollowedHandler,
    userRegistered: UserRegisteredHandler,
    passwordReset: PasswordResetHandler,
    contactSubmitted: ContactSubmittedHandler,
    postCommentCreated: PostCommentCreatedHandler,
    mailSend: MailSendHandler,
  ) {
    const options: RedisClientOptions = {
      url: config.get<string>('REDIS_EVENT_URL', 'redis://localhost:6380'),
      groupName: config.get<string>('kafka.groupId', 'notification-service'),
      streamMaxLen: config.get<number>('REDIS_STREAM_MAX_LEN', 10_000),
    };
    super(options);

    this.handlers = new Map<string, KafkaHandler>([
      ['events:comic.chapter.published', chapterPublished],
      ['events:comic.comment.created',   commentCreated],
      ['events:user.followed.comic',     userFollowed],
      ['events:user.unfollowed.comic',   userUnfollowed],
      ['events:user.registered',         userRegistered],
      ['events:user.password.reset',     passwordReset],
      ['events:contact.submitted',       contactSubmitted],
      ['events:post.comment.created',    postCommentCreated],
      ['events:mail.send',               mailSend],
    ]);
  }

  getStreams(): string[] {
    return Array.from(this.handlers.keys());
  }

  async dispatch(stream: string, fields: Record<string, string>): Promise<void> {
    const handler = this.handlers.get(stream);
    if (!handler) return;

    let payload: any;
    try {
      payload = JSON.parse(fields['value'] ?? '{}');
    } catch {
      this.logger.warn(`Malformed JSON on stream ${stream}`);
      return;
    }

    const eventId =
      payload?.id?.toString() ?? payload?.event_id?.toString() ?? fields['key'] ?? stream;
    const claimed = await this.idempotency.claim(stream, eventId);
    if (!claimed) return;

    try {
      await handler.handle(payload);
    } catch (err: any) {
      await this.idempotency.release(stream, eventId);
      throw err;
    }
  }
}
