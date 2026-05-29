// ---------------------------------------------------------------------------
// Module mocks -- must come before any import
// ---------------------------------------------------------------------------
jest.mock('@package/common', () => ({
  OutboxRelayService: jest.fn(),
}));

jest.mock('@package/bootstrap', () => ({ FileLogger: jest.fn() }));

jest.mock('nestjs-i18n', () => ({
  I18nContext: { current: () => ({ lang: 'en' }) },
  I18nService: jest.fn(),
}));

jest.mock('src/types', () => ({
  toPrimaryKey: (v: string) => BigInt(v),
}), { virtual: true });

jest.mock('src/generated/prisma', () => ({
  PrismaClient: jest.fn(),
  Prisma: {},
}), { virtual: true });

jest.mock('@prisma/adapter-pg', () => ({
  PrismaPg: jest.fn(),
}));

jest.mock('../../../src/core/database/prisma.service', () => ({
  PrismaService: jest.fn(),
}));

jest.mock('@nestjs/schedule', () => ({
  Cron: () => (_target: any, _key: string, _desc: PropertyDescriptor) => {},
}));

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------
import { IamOutboxCronService } from '../../../src/event/services/outbox-relay.service';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeMockOutboxRelay() {
  return {
    init: jest.fn(),
    relay: jest.fn().mockResolvedValue(undefined),
  };
}

function makeMockPrisma() {
  return {} as any;
}

function createService() {
  const outboxRelay = makeMockOutboxRelay();
  const prisma = makeMockPrisma();
  const service = new (IamOutboxCronService as any)(outboxRelay, prisma);
  return { service, outboxRelay, prisma };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('IamOutboxCronService', () => {
  describe('onModuleInit', () => {
    it('should initialise the outbox relay with prisma and config', () => {
      const { service, outboxRelay, prisma } = createService();
      service.onModuleInit();

      expect(outboxRelay.init).toHaveBeenCalledWith(prisma, {
        tableName: 'outbox',
        topicMap: expect.objectContaining({
          'role.changed': 'role.changed',
          'permission.changed': 'permission.changed',
        }),
        lockPrefix: 'iam',
      });
    });
  });

  describe('relayOutbox', () => {
    it('should call relay with the correct table name and topic map', async () => {
      const { service, outboxRelay } = createService();
      await service.relayOutbox();

      expect(outboxRelay.relay).toHaveBeenCalledWith(
        'outbox',
        expect.objectContaining({
          'role.changed': 'role.changed',
          'rbac.cache.invalidate': 'rbac.cache.invalidate',
        }),
      );
    });
  });
});
