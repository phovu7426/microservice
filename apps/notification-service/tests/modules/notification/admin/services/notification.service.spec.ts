// Module mocks - must come before any import
jest.mock('src/generated/prisma', () => ({ PrismaClient: class {}, Prisma: {} }), { virtual: true });
jest.mock('@prisma/adapter-pg', () => ({ PrismaPg: jest.fn() }));
jest.mock('@package/common', () => ({
  t: (_i18n: any, key: string) => key,
  createPaginationMeta: jest.fn().mockReturnValue({ page: 1, limit: 10, total: 0 }),
  parseQueryOptions: jest.fn().mockReturnValue({ skip: 0, take: 10 }),
}));
jest.mock('@package/redis', () => ({ RedisService: jest.fn() }));
jest.mock('nestjs-i18n', () => ({ I18nService: jest.fn() }));
jest.mock('src/types', () => ({ PrimaryKey: BigInt }), { virtual: true });

import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AdminNotificationService } from '../../../../../src/modules/notification/admin/services/notification.service';
import { NotificationRepository } from '../../../../../src/modules/notification/repositories/notification.repository';

describe('AdminNotificationService', () => {
  let service: AdminNotificationService;
  let notifRepo: jest.Mocked<Partial<NotificationRepository>>;
  let redis: { del: jest.Mock; isEnabled: jest.Mock };
  let i18n: any;

  const mockNotification = {
    id: 1n,
    userId: 100n,
    title: 'Test',
    message: 'Hello',
    type: 'info',
    status: 'active',
    isRead: false,
  };

  beforeEach(() => {
    notifRepo = {
      findMany: jest.fn().mockResolvedValue([mockNotification]),
      count: jest.fn().mockResolvedValue(1),
      findById: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      createMany: jest.fn().mockResolvedValue({ count: 2 }),
      update: jest.fn(),
      updateMany: jest.fn(),
      delete: jest.fn(),
    };

    redis = {
      del: jest.fn().mockResolvedValue(1),
      isEnabled: jest.fn().mockReturnValue(true),
    };

    i18n = {};

    service = new AdminNotificationService(
      notifRepo as any,
      i18n,
      redis as any,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getList', () => {
    it('should return paginated list without filters', async () => {
      const query = {} as any;
      const result = await service.getList(query);

      expect(notifRepo.findMany).toHaveBeenCalled();
      expect(notifRepo.count).toHaveBeenCalled();
      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('meta');
    });

    it('should apply userId filter when valid', async () => {
      const query = { userId: '123' } as any;
      await service.getList(query);

      expect(notifRepo.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ userId: '123' }),
        expect.any(Object),
      );
    });

    it('should throw BadRequestException for invalid userId', async () => {
      const query = { userId: 'abc' } as any;

      await expect(service.getList(query)).rejects.toThrow(BadRequestException);
    });

    it('should apply type and status filters', async () => {
      const query = { type: 'info', status: 'active' } as any;
      await service.getList(query);

      expect(notifRepo.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'info', status: 'active' }),
        expect.any(Object),
      );
    });

    it('should apply isRead filter when set to "true"', async () => {
      const query = { isRead: 'true' } as any;
      await service.getList(query);

      expect(notifRepo.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ isRead: true }),
        expect.any(Object),
      );
    });

    it('should apply isRead=false filter when set to "false"', async () => {
      const query = { isRead: 'false' } as any;
      await service.getList(query);

      expect(notifRepo.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ isRead: false }),
        expect.any(Object),
      );
    });

    it('should skip count when skipCount is "true"', async () => {
      const query = { skipCount: 'true' } as any;
      await service.getList(query);

      expect(notifRepo.count).not.toHaveBeenCalled();
    });
  });

  describe('send', () => {
    it('should create notifications for all userIds', async () => {
      const dto = {
        userIds: ['1', '2'],
        title: 'Hello',
        message: 'World',
        type: 'info',
        data: { url: '/test' },
      };

      await service.send(dto as any);

      expect(notifRepo.createMany).toHaveBeenCalledWith([
        { userId: '1', title: 'Hello', message: 'World', type: 'info', data: { url: '/test' }, status: 'active' },
        { userId: '2', title: 'Hello', message: 'World', type: 'info', data: { url: '/test' }, status: 'active' },
      ]);
    });

    it('should invalidate unread cache for all userIds', async () => {
      const dto = { userIds: ['1', '2'], title: 'T', message: 'M' };

      await service.send(dto as any);

      expect(redis.del).toHaveBeenCalledWith('notif:unread:1');
      expect(redis.del).toHaveBeenCalledWith('notif:unread:2');
    });

    it('should return createMany result', async () => {
      const dto = { userIds: ['1'], title: 'T', message: 'M' };
      const result = await service.send(dto as any);

      expect(result).toEqual({ count: 2 });
    });
  });

  describe('delete', () => {
    it('should delete existing notification', async () => {
      notifRepo.findById!.mockResolvedValue(mockNotification);

      const result = await service.delete(1n);

      expect(notifRepo.findById).toHaveBeenCalledWith(1n);
      expect(notifRepo.delete).toHaveBeenCalledWith(1n);
      expect(result).toBe(true);
    });

    it('should throw NotFoundException when notification not found', async () => {
      notifRepo.findById!.mockResolvedValue(null);

      await expect(service.delete(1n)).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('should create a single notification with status active', async () => {
      notifRepo.create!.mockResolvedValue(mockNotification);

      await service.create({ userId: '1', title: 'T', message: 'M', type: 'info' });

      expect(notifRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ userId: '1', title: 'T', message: 'M', type: 'info', status: 'active' }),
      );
    });

    it('should invalidate unread cache after create', async () => {
      notifRepo.create!.mockResolvedValue(mockNotification);

      await service.create({ userId: '42', title: 'T', message: 'M' });

      expect(redis.del).toHaveBeenCalledWith('notif:unread:42');
    });
  });

  describe('createMany', () => {
    it('should create multiple notifications with status active', async () => {
      const notifications = [
        { userId: '1', title: 'A', message: 'B' },
        { userId: '2', title: 'C', message: 'D' },
      ];

      await service.createMany(notifications);

      expect(notifRepo.createMany).toHaveBeenCalledWith([
        { userId: '1', title: 'A', message: 'B', status: 'active' },
        { userId: '2', title: 'C', message: 'D', status: 'active' },
      ]);
    });

    it('should deduplicate userIds for cache invalidation', async () => {
      const notifications = [
        { userId: '1', title: 'A', message: 'B' },
        { userId: '1', title: 'C', message: 'D' },
        { userId: '2', title: 'E', message: 'F' },
      ];

      await service.createMany(notifications);

      expect(redis.del).toHaveBeenCalledTimes(2);
      expect(redis.del).toHaveBeenCalledWith('notif:unread:1');
      expect(redis.del).toHaveBeenCalledWith('notif:unread:2');
    });
  });

  describe('invalidateUnreadCounts (via send)', () => {
    it('should not throw when redis is undefined', async () => {
      const serviceNoRedis = new AdminNotificationService(
        notifRepo as any,
        i18n,
        undefined,
      );

      const dto = { userIds: ['1'], title: 'T', message: 'M' };
      await expect(serviceNoRedis.send(dto as any)).resolves.not.toThrow();
    });

    it('should not throw when redis.del fails', async () => {
      redis.del.mockRejectedValue(new Error('Redis down'));

      const dto = { userIds: ['1'], title: 'T', message: 'M' };
      await expect(service.send(dto as any)).resolves.not.toThrow();
    });
  });
});
