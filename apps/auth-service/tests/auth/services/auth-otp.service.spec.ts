jest.mock('src/generated/prisma', () => ({ PrismaClient: class {}, Prisma: {} }), { virtual: true });
jest.mock('@prisma/adapter-pg', () => ({ PrismaPg: jest.fn() }));

import { ForbiddenException } from '@nestjs/common';

jest.mock('@package/common', () => ({
  t: (_i18n: any, key: string) => key,
}));

jest.mock('@package/bootstrap', () => ({
  FileLogger: jest.fn(),
}));

import { AuthOtpService } from '../../../src/modules/auth/services/auth-otp.service';

jest.mock('../../../src/modules/auth/utils/otp.helper', () => ({
  generateOtp: jest.fn(() => '123456'),
  buildOtpKey: jest.fn((type: string, email: string) => `otp:${type}:${email}`),
}));

function makeRedis(overrides: Record<string, jest.Mock> = {}) {
  return {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1),
    ttl: jest.fn().mockResolvedValue(-2),
    ...overrides,
  } as any;
}

function makeUserRepository(overrides: Record<string, jest.Mock> = {}) {
  return {
    enqueueOutboxEvent: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  } as any;
}

function makeConfig(values: Record<string, string | undefined> = {}) {
  return { get: jest.fn((k: string) => values[k]) } as any;
}

function makeAttemptLimiter(overrides: Record<string, jest.Mock> = {}) {
  return {
    check: jest.fn().mockResolvedValue({ isLocked: false }),
    add: jest.fn(),
    reset: jest.fn(),
    ...overrides,
  } as any;
}

function makeI18n() {
  return {
    t: jest.fn((key: string, opts?: any) => key),
  } as any;
}

const mockLogSession = {
  addDebug: jest.fn().mockReturnThis(),
  addException: jest.fn().mockReturnThis(),
  save: jest.fn(),
};

function makeFileLogger() {
  return { create: jest.fn().mockReturnValue(mockLogSession) } as any;
}

function buildService(deps: {
  redis?: any;
  userRepository?: any;
  config?: any;
  attemptLimiter?: any;
  i18n?: any;
  fileLogger?: any;
} = {}) {
  return new AuthOtpService(
    deps.redis ?? makeRedis(),
    deps.userRepository ?? makeUserRepository(),
    deps.config ?? makeConfig({ OTP_TTL_SECONDS: '300' }),
    deps.attemptLimiter ?? makeAttemptLimiter(),
    deps.i18n ?? makeI18n(),
    deps.fileLogger ?? makeFileLogger(),
  );
}

describe('AuthOtpService', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('verifyAndDelete()', () => {
    it('returns true, deletes OTP, and resets attempts on correct OTP', async () => {
      const redis = makeRedis({ get: jest.fn().mockResolvedValue('123456') });
      const attemptLimiter = makeAttemptLimiter();
      const svc = buildService({ redis, attemptLimiter });

      const result = await svc.verifyAndDelete('register', 'user@test.com', '123456');

      expect(result).toBe(true);
      expect(redis.get).toHaveBeenCalledWith('otp:register:user@test.com');
      expect(redis.del).toHaveBeenCalledWith('otp:register:user@test.com');
      expect(attemptLimiter.reset).toHaveBeenCalledWith('otp:verify:register', 'user@test.com');
      expect(attemptLimiter.add).not.toHaveBeenCalled();
    });

    it('returns false and records failed attempt on wrong OTP', async () => {
      const redis = makeRedis({ get: jest.fn().mockResolvedValue('123456') });
      const attemptLimiter = makeAttemptLimiter();
      const svc = buildService({ redis, attemptLimiter });

      const result = await svc.verifyAndDelete('register', 'user@test.com', '999999');

      expect(result).toBe(false);
      expect(attemptLimiter.add).toHaveBeenCalledWith(
        'otp:verify:register',
        'user@test.com',
        expect.objectContaining({ maxAttempts: 5, lockoutSeconds: 900, windowSeconds: 300 }),
      );
      expect(redis.del).not.toHaveBeenCalled();
      expect(attemptLimiter.reset).not.toHaveBeenCalled();
    });

    it('returns false when no OTP exists in Redis (expired/not sent)', async () => {
      const redis = makeRedis();
      const attemptLimiter = makeAttemptLimiter();
      const svc = buildService({ redis, attemptLimiter });

      const result = await svc.verifyAndDelete('register', 'user@test.com', '123456');

      expect(result).toBe(false);
      expect(attemptLimiter.add).toHaveBeenCalled();
    });

    it('throws ForbiddenException when account is locked from too many attempts', async () => {
      const attemptLimiter = makeAttemptLimiter({
        check: jest.fn().mockResolvedValue({ isLocked: true, remainingMinutes: 15 }),
        add: jest.fn(),
        reset: jest.fn(),
      });
      const redis = makeRedis();
      const svc = buildService({ redis, attemptLimiter });

      await expect(
        svc.verifyAndDelete('register', 'user@test.com', '123456'),
      ).rejects.toThrow(ForbiddenException);

      expect(redis.get).not.toHaveBeenCalled();
    });
  });

  describe('sendRegisterOtp()', () => {
    it('enqueues mail outbox event and stores OTP in Redis', async () => {
      const redis = makeRedis();
      const userRepository = makeUserRepository();
      const svc = buildService({ redis, userRepository });

      await svc.sendRegisterOtp('user@test.com');

      expect(userRepository.enqueueOutboxEvent).toHaveBeenCalledWith('mail.send', {
        to: 'user@test.com',
        templateCode: 'send_otp_register',
        variables: { otp: '123456' },
      });
      expect(redis.set).toHaveBeenCalledWith('otp:register:user@test.com', '123456', 300);
    });

    it('calls redis.del and rethrows if enqueueOutboxEvent fails', async () => {
      const redis = makeRedis();
      const userRepository = makeUserRepository({
        enqueueOutboxEvent: jest.fn().mockRejectedValue(new Error('DB error')),
      });
      const svc = buildService({ redis, userRepository });

      await expect(svc.sendRegisterOtp('user@test.com')).rejects.toThrow('DB error');

      expect(redis.del).toHaveBeenCalledWith('otp:register:user@test.com');
      expect(redis.set).not.toHaveBeenCalled();
    });
  });
});
