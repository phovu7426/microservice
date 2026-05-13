// ---------------------------------------------------------------------------
// Module mocks — must come before any import that transitively loads them.
// ---------------------------------------------------------------------------
jest.mock('src/types', () => ({ toPrimaryKey: (v: any) => BigInt(v) }), { virtual: true });
jest.mock('src/generated/prisma', () => ({ PrismaClient: class {}, Prisma: {} }), { virtual: true });
jest.mock('@prisma/adapter-pg', () => ({ PrismaPg: jest.fn() }));
jest.mock('@package/common', () => ({
  parseQueryOptions: jest.fn().mockReturnValue({ page: 1, skip: 0, take: 10 }),
  createPaginationMeta: jest.fn().mockReturnValue({
    page: 1, limit: 10, total: 1, totalPages: 1,
    hasNextPage: false, hasPreviousPage: false,
  }),
}));
jest.mock('@package/redis', () => ({ RedisService: jest.fn() }));

import { NotFoundException } from '@nestjs/common';
import { AdminContactService } from '../../../../../src/modules/contact/admin/services/contact.service';
import { ContactRepository } from '../../../../../src/modules/contact/repositories/contact.repository';
import { RedisService } from '@package/redis';

describe('AdminContactService', () => {
  let service: AdminContactService;
  let contactRepo: jest.Mocked<Partial<ContactRepository>>;
  let redis: jest.Mocked<Partial<RedisService>>;

  const mockContact = {
    id: 1n,
    name: 'John Doe',
    email: 'john@example.com',
    phone: '0123456789',
    message: 'Hello there',
    status: 'New',
    reply: null,
    repliedAt: null,
    repliedBy: null,
    createdAt: new Date('2025-01-01'),
  };

  beforeEach(() => {
    contactRepo = {
      findMany: jest.fn(),
      count: jest.fn(),
      findById: jest.fn(),
      update: jest.fn(),
    };

    redis = {
      del: jest.fn().mockResolvedValue(undefined),
    };

    service = new AdminContactService(contactRepo as any, redis as any);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getList', () => {
    it('should return paginated contact list', async () => {
      contactRepo.findMany!.mockResolvedValue([mockContact] as any);
      contactRepo.count!.mockResolvedValue(1);

      const result = await service.getList({ page: 1, limit: 10 });

      expect(contactRepo.findMany).toHaveBeenCalled();
      expect(contactRepo.count).toHaveBeenCalled();
      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('meta');
    });

    it('should apply search filter', async () => {
      contactRepo.findMany!.mockResolvedValue([]);
      contactRepo.count!.mockResolvedValue(0);

      await service.getList({ search: 'john' });

      expect(contactRepo.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ search: 'john' }),
        expect.any(Object),
      );
    });

    it('should apply status and email filters', async () => {
      contactRepo.findMany!.mockResolvedValue([]);
      contactRepo.count!.mockResolvedValue(0);

      await service.getList({ status: 'New', email: 'john@example.com' });

      expect(contactRepo.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'New', email: 'john@example.com' }),
        expect.any(Object),
      );
    });

    it('should skip count when skipCount is true', async () => {
      contactRepo.findMany!.mockResolvedValue([]);

      await service.getList({ skipCount: true });

      expect(contactRepo.count).not.toHaveBeenCalled();
    });
  });

  describe('getOne', () => {
    it('should return contact by id', async () => {
      contactRepo.findById!.mockResolvedValue(mockContact as any);

      const result = await service.getOne(1n);

      expect(contactRepo.findById).toHaveBeenCalledWith(1n);
      expect(result).toEqual(mockContact);
    });

    it('should throw NotFoundException when contact not found', async () => {
      contactRepo.findById!.mockResolvedValue(null);

      await expect(service.getOne(1n)).rejects.toThrow(NotFoundException);
      await expect(service.getOne(1n)).rejects.toThrow('Contact not found');
    });
  });

  describe('reply', () => {
    it('should update contact with reply, set status to Replied, and clear cache', async () => {
      const repliedContact = {
        ...mockContact,
        reply: 'Thank you for reaching out',
        status: 'Replied',
        repliedAt: expect.any(Date),
        repliedBy: 5n,
      };

      contactRepo.findById!.mockResolvedValue(mockContact as any);
      contactRepo.update!.mockResolvedValue(repliedContact as any);

      const result = await service.reply(1n, 'Thank you for reaching out', 5n);

      expect(contactRepo.findById).toHaveBeenCalledWith(1n);
      expect(contactRepo.update).toHaveBeenCalledWith(1n, {
        reply: 'Thank you for reaching out',
        status: 'Replied',
        repliedAt: expect.any(Date),
        repliedBy: 5n,
      });
      expect(redis.del).toHaveBeenCalledWith('marketing:admin:contacts:list');
      expect(result).toEqual(repliedContact);
    });

    it('should work without actorId', async () => {
      contactRepo.findById!.mockResolvedValue(mockContact as any);
      contactRepo.update!.mockResolvedValue({ ...mockContact, reply: 'Hi' } as any);

      await service.reply(1n, 'Hi');

      expect(contactRepo.update).toHaveBeenCalledWith(1n, {
        reply: 'Hi',
        status: 'Replied',
        repliedAt: expect.any(Date),
        repliedBy: undefined,
      });
    });

    it('should throw NotFoundException when contact does not exist', async () => {
      contactRepo.findById!.mockResolvedValue(null);

      await expect(service.reply(1n, 'reply text')).rejects.toThrow(NotFoundException);
    });
  });

  describe('markAsRead', () => {
    it('should update contact status to Read and clear cache', async () => {
      const readContact = { ...mockContact, status: 'Read' };

      contactRepo.findById!.mockResolvedValue(mockContact as any);
      contactRepo.update!.mockResolvedValue(readContact as any);

      const result = await service.markAsRead(1n);

      expect(contactRepo.findById).toHaveBeenCalledWith(1n);
      expect(contactRepo.update).toHaveBeenCalledWith(1n, { status: 'Read' });
      expect(redis.del).toHaveBeenCalledWith('marketing:admin:contacts:list');
      expect(result).toEqual(readContact);
    });

    it('should throw NotFoundException when contact does not exist', async () => {
      contactRepo.findById!.mockResolvedValue(null);

      await expect(service.markAsRead(1n)).rejects.toThrow(NotFoundException);
    });
  });

  describe('closeContact', () => {
    it('should update contact status to Closed and clear cache', async () => {
      const closedContact = { ...mockContact, status: 'Closed' };

      contactRepo.findById!.mockResolvedValue(mockContact as any);
      contactRepo.update!.mockResolvedValue(closedContact as any);

      const result = await service.closeContact(1n);

      expect(contactRepo.findById).toHaveBeenCalledWith(1n);
      expect(contactRepo.update).toHaveBeenCalledWith(1n, { status: 'Closed' });
      expect(redis.del).toHaveBeenCalledWith('marketing:admin:contacts:list');
      expect(result).toEqual(closedContact);
    });

    it('should throw NotFoundException when contact does not exist', async () => {
      contactRepo.findById!.mockResolvedValue(null);

      await expect(service.closeContact(1n)).rejects.toThrow(NotFoundException);
    });
  });

  describe('clearCache', () => {
    it('should not throw when redis is undefined', async () => {
      const serviceNoRedis = new AdminContactService(contactRepo as any, undefined);

      contactRepo.findById!.mockResolvedValue(mockContact as any);
      contactRepo.update!.mockResolvedValue({ ...mockContact, status: 'Read' } as any);

      await expect(serviceNoRedis.markAsRead(1n)).resolves.toBeDefined();
    });
  });
});
