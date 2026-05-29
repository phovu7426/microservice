// Top of file — mock modules that have complex dependencies
jest.mock('src/generated/prisma', () => ({ PrismaClient: class {}, Prisma: {} }), { virtual: true });
jest.mock('@prisma/adapter-pg', () => ({ PrismaPg: jest.fn() }));
jest.mock('@package/common', () => ({
  IdempotencyService: jest.fn(),
  t: (_i18n: any, key: string) => key,
  createPaginationMeta: jest.fn(),
  parseQueryOptions: jest.fn(),
}));
jest.mock('@package/redis', () => ({ RedisService: jest.fn() }));
jest.mock('@golevelup/nestjs-rabbitmq', () => ({
  RabbitSubscribe: () => () => {},
  MessageHandlerErrorBehavior: { NACK: 'nack' },
}));

import { RabbitmqConsumerService } from '../../src/event/rabbitmq/rabbitmq-consumer.service';

const makeHandler = () => ({ handle: jest.fn().mockResolvedValue(undefined) });

describe('RabbitmqConsumerService', () => {
  let service: RabbitmqConsumerService;
  let idempotency: { claim: jest.Mock };
  let chapterPublished: ReturnType<typeof makeHandler>;
  let userRegistered: ReturnType<typeof makeHandler>;
  let mailSend: ReturnType<typeof makeHandler>;

  beforeEach(() => {
    idempotency = { claim: jest.fn().mockResolvedValue(true) };
    chapterPublished = makeHandler();
    userRegistered = makeHandler();
    mailSend = makeHandler();

    service = new RabbitmqConsumerService(
      idempotency as any,
      chapterPublished as any,
      makeHandler() as any, // commentCreated
      makeHandler() as any, // userFollowed
      makeHandler() as any, // userUnfollowed
      userRegistered as any,
      makeHandler() as any, // passwordReset
      makeHandler() as any, // contactSubmitted
      makeHandler() as any, // postCommentCreated
      mailSend as any,
    );
  });

  afterEach(() => jest.clearAllMocks());

  it('dispatches chapter.published with payload.id as eventId', async () => {
    await service.onChapterPublished({ id: '42', comic_id: '123' });
    expect(idempotency.claim).toHaveBeenCalledWith('comic.chapter.published', '42');
    expect(chapterPublished.handle).toHaveBeenCalledWith({ id: '42', comic_id: '123' });
  });

  it('skips handler when idempotency claim returns false', async () => {
    idempotency.claim.mockResolvedValue(false);
    await service.onChapterPublished({ id: '42' });
    expect(chapterPublished.handle).not.toHaveBeenCalled();
  });

  it('dispatches user.registered with payload.id as eventId', async () => {
    await service.onUserRegistered({ id: '7', email: 'x@x.com' });
    expect(idempotency.claim).toHaveBeenCalledWith('user.registered', '7');
    expect(userRegistered.handle).toHaveBeenCalledWith({ id: '7', email: 'x@x.com' });
  });

  it('dispatches mail.send using payload.event_id as eventId', async () => {
    await service.onMailSend({ event_id: 'abc', to: 'a@b.com', templateCode: 'welcome' });
    expect(idempotency.claim).toHaveBeenCalledWith('mail.send', 'abc');
    expect(mailSend.handle).toHaveBeenCalledWith({ event_id: 'abc', to: 'a@b.com', templateCode: 'welcome' });
  });

  it('falls back to Date.now() eventId when payload has no id or event_id', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(12345);
    await service.onUserRegistered({ email: 'x@x.com' });
    expect(idempotency.claim).toHaveBeenCalledWith('user.registered', '12345');
  });

  it('releases idempotency claim when handler throws, allowing redelivery', async () => {
    const error = new Error('handler failed');
    chapterPublished.handle.mockRejectedValue(error);
    // need a release mock on idempotency
    (idempotency as any).release = jest.fn().mockResolvedValue(undefined);

    await expect(service.onChapterPublished({ id: '99' })).rejects.toThrow('handler failed');
    expect((idempotency as any).release).toHaveBeenCalledWith('comic.chapter.published', '99');
  });
});
