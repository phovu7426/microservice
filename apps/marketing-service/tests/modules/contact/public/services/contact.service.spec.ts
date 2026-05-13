// ---------------------------------------------------------------------------
// Module mocks — must come before any import that transitively loads them.
// ---------------------------------------------------------------------------
jest.mock('src/types', () => ({ toPrimaryKey: (v: any) => BigInt(v) }), { virtual: true });
jest.mock('src/generated/prisma', () => ({ PrismaClient: class {}, Prisma: {} }), { virtual: true });
jest.mock('@prisma/adapter-pg', () => ({ PrismaPg: jest.fn() }));

import { PublicContactService } from '../../../../../src/modules/contact/public/services/contact.service';
import { ContactRepository } from '../../../../../src/modules/contact/repositories/contact.repository';
import { ConfigService } from '@nestjs/config';

describe('PublicContactService', () => {
  let service: PublicContactService;
  let contactRepo: jest.Mocked<Partial<ContactRepository>>;
  let configService: jest.Mocked<Partial<ConfigService>>;

  const mockCreatedContact = {
    id: 1n,
    name: 'Jane Doe',
    email: 'jane@example.com',
    phone: '0987654321',
    message: 'I need help',
    status: 'New',
    createdAt: new Date('2025-01-01T00:00:00.000Z'),
  };

  const createDto = {
    name: 'Jane Doe',
    email: 'jane@example.com',
    phone: '0987654321',
    message: 'I need help',
  };

  beforeEach(() => {
    contactRepo = {
      create: jest.fn(),
      createOutbox: jest.fn(),
      withTransaction: jest.fn(),
    };

    configService = {
      get: jest.fn(),
    };

    service = new PublicContactService(contactRepo as any, configService as any);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create contact with Kafka outbox when kafka is enabled', async () => {
      configService.get!.mockReturnValue(true);

      const mockTx = {};
      contactRepo.withTransaction!.mockImplementation(async (fn: any) => fn(mockTx));
      contactRepo.create!.mockResolvedValue(mockCreatedContact as any);
      contactRepo.createOutbox!.mockResolvedValue(undefined as any);

      const result = await service.create(createDto as any);

      expect(contactRepo.withTransaction).toHaveBeenCalled();
      expect(contactRepo.create).toHaveBeenCalledWith(
        {
          name: 'Jane Doe',
          email: 'jane@example.com',
          phone: '0987654321',
          message: 'I need help',
        },
        mockTx,
      );
      expect(contactRepo.createOutbox).toHaveBeenCalledWith(
        'contact.submitted',
        expect.objectContaining({
          contact_id: String(1n),
          name: 'Jane Doe',
          email: 'jane@example.com',
          phone: '0987654321',
          message: 'I need help',
          created_at: mockCreatedContact.createdAt.toISOString(),
        }),
        mockTx,
      );
      expect(result).toEqual({
        success: true,
        message: 'Contact submitted successfully',
        data: {
          id: 1n,
          name: 'Jane Doe',
          email: 'jane@example.com',
          created_at: mockCreatedContact.createdAt,
        },
      });
    });

    it('should create contact without Kafka outbox when kafka is disabled', async () => {
      configService.get!.mockReturnValue(false);

      const mockTx = {};
      contactRepo.withTransaction!.mockImplementation(async (fn: any) => fn(mockTx));
      contactRepo.create!.mockResolvedValue(mockCreatedContact as any);

      const result = await service.create(createDto as any);

      expect(contactRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Jane Doe' }),
        mockTx,
      );
      expect(contactRepo.createOutbox).not.toHaveBeenCalled();
      expect(result).toEqual({
        success: true,
        message: 'Contact submitted successfully',
        data: expect.objectContaining({ id: 1n }),
      });
    });

    it('should create contact without Kafka outbox when kafka config is undefined', async () => {
      configService.get!.mockReturnValue(undefined);

      const mockTx = {};
      contactRepo.withTransaction!.mockImplementation(async (fn: any) => fn(mockTx));
      contactRepo.create!.mockResolvedValue(mockCreatedContact as any);

      await service.create(createDto as any);

      expect(contactRepo.createOutbox).not.toHaveBeenCalled();
    });

    it('should stringify BigInt contact_id in outbox payload', async () => {
      configService.get!.mockReturnValue(true);

      const mockTx = {};
      contactRepo.withTransaction!.mockImplementation(async (fn: any) => fn(mockTx));
      contactRepo.create!.mockResolvedValue({
        ...mockCreatedContact,
        id: 9007199254740993n, // > Number.MAX_SAFE_INTEGER
      } as any);
      contactRepo.createOutbox!.mockResolvedValue(undefined as any);

      await service.create(createDto as any);

      expect(contactRepo.createOutbox).toHaveBeenCalledWith(
        'contact.submitted',
        expect.objectContaining({
          contact_id: '9007199254740993',
        }),
        mockTx,
      );
    });

    it('should propagate transaction errors', async () => {
      configService.get!.mockReturnValue(true);

      contactRepo.withTransaction!.mockRejectedValue(new Error('Transaction failed'));

      await expect(service.create(createDto as any)).rejects.toThrow('Transaction failed');
    });

    it('should return only id, name, email, created_at in response data', async () => {
      configService.get!.mockReturnValue(false);

      const mockTx = {};
      contactRepo.withTransaction!.mockImplementation(async (fn: any) => fn(mockTx));
      contactRepo.create!.mockResolvedValue(mockCreatedContact as any);

      const result = await service.create(createDto as any);

      const responseData = result.data;
      expect(responseData).toHaveProperty('id');
      expect(responseData).toHaveProperty('name');
      expect(responseData).toHaveProperty('email');
      expect(responseData).toHaveProperty('created_at');
      expect(responseData).not.toHaveProperty('phone');
      expect(responseData).not.toHaveProperty('message');
      expect(responseData).not.toHaveProperty('status');
    });
  });
});
