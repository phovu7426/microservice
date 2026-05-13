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

import { NotFoundException } from '@nestjs/common';
import { UserNotificationService } from '../../../../../src/modules/notification/user/services/notification.service';
import { NotificationRepository } from '../../../../../src/modules/notification/repositories/notification.repository';

describe('UserNotificationService', () => {
  let service: UserNotificationService;
  let notifRepo: jest.Mocked<Partial<NotificationRepository>>;
  let redis: { get: jest.Mock; set: jest.Mock; del: jest.Mock; isEnabled: jest.Mock };
  let i18n: any;

  const userId = '100';

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
      count: jest.fn().mockResolvedValue(5),
      findById: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      createMany: jest.fn(),
      update: jest.fn().mockResolvedValue({ ...mockNotification, isRead: true }),
      updateMany: jest.fn().mockResolvedValue({ count: 3 }),
      delete: jest.fn(),
    };

    redis = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue('OK'),
      del: jest.fn().mockResolvedValue(1),
      isEnabled: jest.fn().mockReturnValue(true),
    };

    i18n = {};

    service = new UserNotificationService(
      notifRepo as any,
      i18n,
      redis as any,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getList', () => {
    it('should return paginated notifications for user', async () => {
      const query = {} as any;
      const result = await service.getList(userId, query);

      expect(notifRepo.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ userId, status: 'active' }),
        expect.any(Object),
      );
      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('meta');
    });

    it('should apply type filter', async () => {
      const query = { type: 'alert' } as any;
      await service.getList(userId, query);

      expect(notifRepo.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'alert' }),
        expect.any(Object),
      );
    });

    it('should apply isRead filter', async () => {
      const query = { isRead: 'true' } as any;
      await service.getList(userId, query);

      expect(notifRepo.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ isRead: true }),
        expect.any(Object),
      );
    });

    it('should skip count when skipCount is "true"', async () => {
      const query = { skipCount: 'true' } as any;
      await service.getList(userId, query);

      expect(notifRepo.count).not.toHaveBeenCalled();
    });

    it('should count when skipCount is not "true"', async () => {
      const query = {} as any;
      await service.getList(userId, query);

      expect(notifRepo.count).toHaveBeenCalledWith(
        expect.objectContaining({ userId, status: 'active' }),
      );
    });
  });

  describe('getUnreadCount', () => {
    it('should return cached count when available', async () => {
      redis.get.mockResolvedValue('7');

      const result = await service.getUnreadCount(userId);

      expect(result).toEqual({ count: 7 });
      expect(notifRepo.count).not.toHaveBeenCalled();
    });

    it('should query database and cache result when cache miss', async () => {
      redis.get.mockResolvedValue(null);
      notifRepo.count!.mockResolvedValue(5);

      const result = await service.getUnreadCount(userId);

      expect(result).toEqual({ count: 5 });
      expect(notifRepo.count).toHaveBeenCalledWith({
        userId,
        isRead: false,
        status: 'active',
      });
      expect(redis.set).toHaveBeenCalledWith(`notif:unread:${userId}`, '5', 30);
    });

    it('should query database when redis.get fails', async () => {
      redis.get.mockRejectedValue(new Error('Redis down'));
      notifRepo.count!.mockResolvedValue(3);

      const result = await service.getUnreadCount(userId);

      expect(result).toEqual({ count: 3 });
    });

    it('should not throw when redis.set fails after db query', async () => {
      redis.get.mockResolvedValue(null);
      notifRepo.count!.mockResolvedValue(2);
      redis.set.mockRejectedValue(new Error('Redis down'));

      const result = await service.getUnreadCount(userId);

      expect(result).toEqual({ count: 2 });
    });

    it('should return cached count 0 correctly', async () => {
      redis.get.mockResolvedValue('0');

      const result = await service.getUnreadCount(userId);

      expect(result).toEqual({ count: 0 });
      expect(notifRepo.count).not.toHaveBeenCalled();
    });
  });

  describe('getOne', () => {
    it('should return notification belonging to user', async () => {
      notifRepo.findFirst!.mockResolvedValue(mockNotification);

      const result = await service.getOne(userId, 1n);

      expect(notifRepo.findFirst).toHaveBeenCalledWith({ id: 1n, userId });
      expect(result).toEqual(mockNotification);
    });

    it('should throw NotFoundException when not found', async () => {
      notifRepo.findFirst!.mockResolvedValue(null);

      await expect(service.getOne(userId, 1n)).rejects.toThrow(NotFoundException);
    });
  });

  describe('markAsRead', () => {
    it('should mark notification as read and invalidate cache', async () => {
      notifRepo.findFirst!.mockResolvedValue(mockNotification);

      const result = await service.markAsRead(userId, 1n);

      expect(notifRepo.update).toHaveBeenCalledWith(
        mockNotification.id,
        expect.objectContaining({ isRead: true, readAt: expect.any(Date) }),
      );
      expect(redis.del).toHaveBeenCalledWith(`notif:unread:${userId}`);
      expect(result).toEqual(expect.objectContaining({ isRead: true }));
    });

    it('should throw NotFoundException when notification does not belong to user', async () => {
      notifRepo.findFirst!.mockResolvedValue(null);

      await expect(service.markAsRead(userId, 999n)).rejects.toThrow(NotFoundException);
    });
  });

  describe('markAllAsRead', () => {
    it('should update all unread notifications for user', async () => {
      notifRepo.updateMany!.mockResolvedValue({ count: 3 });

      const result = await service.markAllAsRead(userId);

      expect(notifRepo.updateMany).toHaveBeenCalledWith(
        { userId, isRead: false },
        expect.objectContaining({ isRead: true, readAt: expect.any(Date) }),
      );
      expect(result).toEqual({ updated: 3 });
    });

    it('should invalidate unread cache after marking all', async () => {
      notifRepo.updateMany!.mockResolvedValue({ count: 0 });

      await service.markAllAsRead(userId);

      expect(redis.del).toHaveBeenCalledWith(`notif:unread:${userId}`);
    });
  });

  describe('invalidateUnreadCount', () => {
    it('should not throw when redis is undefined', async () => {
      const serviceNoRedis = new UserNotificationService(
        notifRepo as any,
        i18n,
        undefined,
      );

      await expect(serviceNoRedis.invalidateUnreadCount(userId)).resolves.not.toThrow();
    });

    it('should not throw when redis.del fails', async () => {
      redis.del.mockRejectedValue(new Error('Redis down'));

      await expect(service.invalidateUnreadCount(userId)).resolves.not.toThrow();
    });
  });
});
