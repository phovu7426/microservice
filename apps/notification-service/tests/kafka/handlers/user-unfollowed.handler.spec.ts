jest.mock('src/generated/prisma', () => ({ PrismaClient: class {}, Prisma: {} }), { virtual: true });
jest.mock('@prisma/adapter-pg', () => ({ PrismaPg: jest.fn() }));
jest.mock('src/types', () => ({ PrimaryKey: BigInt }), { virtual: true });

import { UserUnfollowedHandler } from '../../../src/event/kafka/handlers/user-unfollowed.handler';

describe('UserUnfollowedHandler', () => {
  let handler: UserUnfollowedHandler;
  let followersProjectionRepo: { deleteMany: jest.Mock };

  beforeEach(() => {
    followersProjectionRepo = { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) };
    handler = new UserUnfollowedHandler(followersProjectionRepo as any);
  });

  afterEach(() => jest.clearAllMocks());

  it('should delete follower projection entry', async () => {
    await handler.handle({ user_id: '10', comic_id: '5' });

    expect(followersProjectionRepo.deleteMany).toHaveBeenCalledWith(10n, 5n);
  });
});
