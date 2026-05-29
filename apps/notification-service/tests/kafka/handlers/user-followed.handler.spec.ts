jest.mock('src/generated/prisma', () => ({ PrismaClient: class {}, Prisma: {} }), { virtual: true });
jest.mock('@prisma/adapter-pg', () => ({ PrismaPg: jest.fn() }));
jest.mock('src/types', () => ({ PrimaryKey: BigInt }), { virtual: true });

import { UserFollowedHandler } from '../../../src/event/kafka/handlers/user-followed.handler';

describe('UserFollowedHandler', () => {
  let handler: UserFollowedHandler;
  let followersProjectionRepo: { upsert: jest.Mock };

  beforeEach(() => {
    followersProjectionRepo = { upsert: jest.fn().mockResolvedValue({}) };
    handler = new UserFollowedHandler(followersProjectionRepo as any);
  });

  afterEach(() => jest.clearAllMocks());

  it('should upsert follower projection with provided followed_at', async () => {
    const date = '2025-01-01T00:00:00Z';
    await handler.handle({ user_id: '10', comic_id: '5', followed_at: date });

    expect(followersProjectionRepo.upsert).toHaveBeenCalledWith(
      10n,
      5n,
      new Date(date),
    );
  });

  it('should default to now when followed_at is not provided', async () => {
    const before = new Date();
    await handler.handle({ user_id: '10', comic_id: '5' });
    const after = new Date();

    const callDate = followersProjectionRepo.upsert.mock.calls[0][2] as Date;
    expect(callDate.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(callDate.getTime()).toBeLessThanOrEqual(after.getTime());
  });
});
