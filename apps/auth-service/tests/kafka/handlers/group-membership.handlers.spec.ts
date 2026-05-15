// ---------------------------------------------------------------------------
// Module mocks — must come before any import that transitively loads them.
// ---------------------------------------------------------------------------
jest.mock('src/types', () => ({ PrimaryKey: BigInt }), { virtual: true });
jest.mock('../../../src/core/database/prisma.service', () => ({
  PrismaService: jest.fn(),
}));

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------
import { GroupMemberAddedHandler } from '../../../src/kafka/handlers/group-member-added.handler';
import { GroupMemberRemovedHandler } from '../../../src/kafka/handlers/group-member-removed.handler';
import { GroupDeletedHandler } from '../../../src/kafka/handlers/group-deleted.handler';
import { GroupMemberAddedEvent, GroupMemberRemovedEvent, GroupDeletedEvent } from '@package/shared-types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makePrisma() {
  return {
    userGroup: {
      upsert: jest.fn().mockResolvedValue({}),
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('GroupMemberAddedHandler', () => {
  let handler: GroupMemberAddedHandler;
  let prisma: ReturnType<typeof makePrisma>;

  beforeEach(() => {
    prisma = makePrisma();
    handler = new GroupMemberAddedHandler(prisma as any);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should upsert the user_group record', async () => {
    const payload: GroupMemberAddedEvent = {
      group_id: '100',
      user_id: '42',
      timestamp: '2026-01-01T00:00:00Z',
    };

    await handler.handle(payload);

    expect(prisma.userGroup.upsert).toHaveBeenCalledTimes(1);
    expect(prisma.userGroup.upsert).toHaveBeenCalledWith({
      where: { userId_groupId: { userId: 42n, groupId: 100n } },
      create: { userId: 42n, groupId: 100n },
      update: {},
    });
  });

  it('should be idempotent — calling twice does not throw', async () => {
    const payload: GroupMemberAddedEvent = {
      group_id: '100',
      user_id: '42',
      timestamp: '2026-01-01T00:00:00Z',
    };

    await handler.handle(payload);
    await handler.handle(payload);

    expect(prisma.userGroup.upsert).toHaveBeenCalledTimes(2);
    expect(prisma.userGroup.upsert).toHaveBeenNthCalledWith(1, {
      where: { userId_groupId: { userId: 42n, groupId: 100n } },
      create: { userId: 42n, groupId: 100n },
      update: {},
    });
    expect(prisma.userGroup.upsert).toHaveBeenNthCalledWith(2, {
      where: { userId_groupId: { userId: 42n, groupId: 100n } },
      create: { userId: 42n, groupId: 100n },
      update: {},
    });
  });

  it('should correctly convert string ids to BigInt', async () => {
    const payload: GroupMemberAddedEvent = {
      group_id: '9007199254740993',
      user_id: '9007199254740994',
      timestamp: '2026-01-01T00:00:00Z',
    };

    await handler.handle(payload);

    expect(prisma.userGroup.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId_groupId: {
            userId: BigInt('9007199254740994'),
            groupId: BigInt('9007199254740993'),
          },
        },
      }),
    );
  });
});

describe('GroupMemberRemovedHandler', () => {
  let handler: GroupMemberRemovedHandler;
  let prisma: ReturnType<typeof makePrisma>;

  beforeEach(() => {
    prisma = makePrisma();
    handler = new GroupMemberRemovedHandler(prisma as any);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should call deleteMany with userId and groupId', async () => {
    const payload: GroupMemberRemovedEvent = {
      group_id: '100',
      user_id: '42',
      timestamp: '2026-01-01T00:00:00Z',
    };

    await handler.handle(payload);

    expect(prisma.userGroup.deleteMany).toHaveBeenCalledTimes(1);
    expect(prisma.userGroup.deleteMany).toHaveBeenCalledWith({
      where: { userId: 42n, groupId: 100n },
    });
  });

  it('should not throw if record does not exist (count: 0)', async () => {
    prisma.userGroup.deleteMany.mockResolvedValue({ count: 0 });

    const payload: GroupMemberRemovedEvent = {
      group_id: '999',
      user_id: '888',
      timestamp: '2026-01-01T00:00:00Z',
    };

    await expect(handler.handle(payload)).resolves.toBeUndefined();
    expect(prisma.userGroup.deleteMany).toHaveBeenCalledTimes(1);
  });

  it('should correctly convert string ids to BigInt', async () => {
    const payload: GroupMemberRemovedEvent = {
      group_id: '9007199254740993',
      user_id: '9007199254740994',
      timestamp: '2026-01-01T00:00:00Z',
    };

    await handler.handle(payload);

    expect(prisma.userGroup.deleteMany).toHaveBeenCalledWith({
      where: {
        userId: BigInt('9007199254740994'),
        groupId: BigInt('9007199254740993'),
      },
    });
  });
});

describe('GroupDeletedHandler', () => {
  let handler: GroupDeletedHandler;
  let prisma: ReturnType<typeof makePrisma>;

  beforeEach(() => {
    prisma = makePrisma();
    handler = new GroupDeletedHandler(prisma as any);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should call deleteMany with only groupId to remove all members', async () => {
    const payload: GroupDeletedEvent = {
      group_id: '100',
      timestamp: '2026-01-01T00:00:00Z',
    };

    await handler.handle(payload);

    expect(prisma.userGroup.deleteMany).toHaveBeenCalledTimes(1);
    expect(prisma.userGroup.deleteMany).toHaveBeenCalledWith({
      where: { groupId: 100n },
    });
  });

  it('should not throw if group has no members (count: 0)', async () => {
    prisma.userGroup.deleteMany.mockResolvedValue({ count: 0 });

    const payload: GroupDeletedEvent = {
      group_id: '999',
      timestamp: '2026-01-01T00:00:00Z',
    };

    await expect(handler.handle(payload)).resolves.toBeUndefined();
  });

  it('should delete all members when group has many', async () => {
    prisma.userGroup.deleteMany.mockResolvedValue({ count: 50 });

    const payload: GroupDeletedEvent = {
      group_id: '200',
      timestamp: '2026-01-01T00:00:00Z',
    };

    await handler.handle(payload);

    expect(prisma.userGroup.deleteMany).toHaveBeenCalledWith({
      where: { groupId: 200n },
    });
  });

  it('should correctly convert large group_id string to BigInt', async () => {
    const payload: GroupDeletedEvent = {
      group_id: '9007199254740993',
      timestamp: '2026-01-01T00:00:00Z',
    };

    await handler.handle(payload);

    expect(prisma.userGroup.deleteMany).toHaveBeenCalledWith({
      where: { groupId: BigInt('9007199254740993') },
    });
  });
});
