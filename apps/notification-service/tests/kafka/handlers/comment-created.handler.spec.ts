jest.mock('src/generated/prisma', () => ({ PrismaClient: class {}, Prisma: {} }), { virtual: true });
jest.mock('@prisma/adapter-pg', () => ({ PrismaPg: jest.fn() }));
jest.mock('@package/common', () => ({ t: jest.fn(), createPaginationMeta: jest.fn(), parseQueryOptions: jest.fn() }));
jest.mock('@package/redis', () => ({ RedisService: jest.fn() }));
jest.mock('nestjs-i18n', () => ({ I18nService: jest.fn() }));
jest.mock('src/types', () => ({ PrimaryKey: BigInt }), { virtual: true });

import { CommentCreatedHandler } from '../../../src/event/kafka/handlers/comment-created.handler';

describe('CommentCreatedHandler', () => {
  let handler: CommentCreatedHandler;
  let notifService: { create: jest.Mock };

  beforeEach(() => {
    notifService = { create: jest.fn().mockResolvedValue({}) };
    handler = new CommentCreatedHandler(notifService as any);
  });

  afterEach(() => jest.clearAllMocks());

  it('should skip when parent_comment_user_id is falsy', async () => {
    await handler.handle({ parent_comment_user_id: null, user_id: '1' });
    expect(notifService.create).not.toHaveBeenCalled();
  });

  it('should skip when commenter is the parent comment author', async () => {
    await handler.handle({ parent_comment_user_id: '5', user_id: '5', comic_id: '1' });
    expect(notifService.create).not.toHaveBeenCalled();
  });

  it('should create notification for parent comment author', async () => {
    await handler.handle({
      parent_comment_user_id: '10',
      user_id: '20',
      comic_id: '1',
      comment_id: '99',
    });

    expect(notifService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: '10',
        type: 'info',
        data: { comic_id: '1', comment_id: '99' },
      }),
    );
  });
});
