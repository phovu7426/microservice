// ---------------------------------------------------------------------------
// Module mocks — must come before any import that transitively loads them.
// ---------------------------------------------------------------------------
jest.mock('@package/common', () => ({
  t: (_i18n: any, key: string) => key,
}));

jest.mock('@package/bootstrap', () => ({
  FileLogger: jest.fn(),
}));

jest.mock('nestjs-i18n', () => ({
  I18nContext: { current: () => ({ lang: 'en' }) },
  I18nService: jest.fn(),
}));

jest.mock('../../../src/modules/auth/services/token.service', () => ({
  TokenService: jest.fn(),
}));

jest.mock('../../../src/modules/auth/repositories/user.repository', () => ({
  UserRepository: jest.fn(),
}));

jest.mock('../../../src/modules/auth/utils/user.util', () => ({
  safeUser: (u: any) => u,
}));

jest.mock('src/types', () => ({
  toPrimaryKey: (v: string) => BigInt(v),
}), { virtual: true });

jest.mock('src/generated/prisma', () => ({
  Prisma: {
    PrismaClientKnownRequestError: class PrismaClientKnownRequestError extends Error {
      code: string;
      meta: any;
      constructor(msg: string, opts: { code: string; meta?: any; clientVersion?: string }) {
        super(msg);
        this.code = opts.code;
        this.meta = opts.meta;
      }
    },
  },
}), { virtual: true });

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------
import { ConflictException, ForbiddenException } from '@nestjs/common';
import { SocialAuthService } from '../../../src/modules/auth/services/social-auth.service';
import { Prisma } from 'src/generated/prisma';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMockUserRepo() {
  return {
    findByEmail: jest.fn(),
    update: jest.fn(),
    create: jest.fn(),
    withTransaction: jest.fn(),
    enqueueOutboxEvent: jest.fn(),
  };
}

function makeMockTokenService() {
  return {
    generateTokens: jest.fn(),
    storeRefreshJti: jest.fn(),
  };
}

const defaultTokens = {
  accessToken: 'access-token',
  refreshToken: 'refresh-token',
  refreshJti: 'jti-123',
  accessTtlSec: 3600,
  refreshTtlSec: 604800,
};

function makeExistingUser(overrides: Record<string, any> = {}) {
  return {
    id: BigInt(1),
    email: 'john@example.com',
    username: 'john',
    name: 'John Doe',
    image: null,
    googleId: 'google-123',
    status: 'active',
    emailVerifiedAt: new Date('2024-01-01'),
    lastLoginAt: new Date('2024-01-01'),
    ...overrides,
  };
}

function makeProfile(overrides: Record<string, any> = {}) {
  return {
    googleId: 'google-123',
    email: 'John@Example.com',
    firstName: 'John',
    lastName: 'Doe',
    picture: 'https://img.example.com/photo.jpg',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('SocialAuthService', () => {
  let service: SocialAuthService;
  let userRepo: ReturnType<typeof makeMockUserRepo>;
  let tokenService: ReturnType<typeof makeMockTokenService>;
  const i18n = {} as any;
  const mockLogSession = {
    addDebug: jest.fn().mockReturnThis(),
    addException: jest.fn().mockReturnThis(),
    save: jest.fn(),
  };
  const fileLogger = { create: jest.fn().mockReturnValue(mockLogSession) };

  beforeEach(() => {
    userRepo = makeMockUserRepo();
    tokenService = makeMockTokenService();
    jest.clearAllMocks();
    fileLogger.create.mockReturnValue(mockLogSession);
    service = new SocialAuthService(userRepo as any, tokenService as any, i18n, fileLogger as any);
    tokenService.generateTokens.mockResolvedValue(defaultTokens);
    tokenService.storeRefreshJti.mockResolvedValue(undefined);
  });

  // -----------------------------------------------------------------------
  // 1. Existing user — updates and returns tokens
  // -----------------------------------------------------------------------
  it('updates existing user and returns tokens', async () => {
    const existing = makeExistingUser();
    const profile = makeProfile();
    userRepo.findByEmail.mockResolvedValue(existing);
    userRepo.update.mockResolvedValue({ ...existing, name: 'John Doe', image: profile.picture });

    const result = await service.handleGoogleAuth(profile);

    expect(userRepo.findByEmail).toHaveBeenCalledWith('john@example.com');
    expect(userRepo.update).toHaveBeenCalledWith(
      existing.id,
      expect.objectContaining({
        name: 'John Doe',
        image: profile.picture,
        googleId: profile.googleId,
      }),
    );
    expect(tokenService.generateTokens).toHaveBeenCalledWith(existing.id, 'john@example.com');
    expect(tokenService.storeRefreshJti).toHaveBeenCalledWith(
      existing.id,
      defaultTokens.refreshJti,
      defaultTokens.refreshTtlSec,
    );
    expect(result).toEqual(
      expect.objectContaining({
        token: 'access-token',
        refreshToken: 'refresh-token',
        expiresIn: 3600,
      }),
    );
  });

  // -----------------------------------------------------------------------
  // 2. New user — creates with unique username and enqueues outbox event
  // -----------------------------------------------------------------------
  it('creates new user with unique username and enqueues outbox event', async () => {
    const profile = makeProfile();
    const createdUser = makeExistingUser({ username: 'john_abc123' });

    userRepo.findByEmail.mockResolvedValue(null);
    userRepo.withTransaction.mockImplementation(async (fn: Function) => fn('tx'));
    userRepo.create.mockResolvedValue(createdUser);
    userRepo.enqueueOutboxEvent.mockResolvedValue(undefined);

    const result = await service.handleGoogleAuth(profile);

    expect(userRepo.withTransaction).toHaveBeenCalled();
    expect(userRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'john@example.com',
        name: 'John Doe',
        googleId: profile.googleId,
        status: 'active',
      }),
      'tx',
    );
    expect(userRepo.enqueueOutboxEvent).toHaveBeenCalledWith(
      'user.registered',
      expect.objectContaining({
        user_id: String(createdUser.id),
        email: createdUser.email,
        source: 'google',
      }),
      'tx',
    );
    expect(result.token).toBe('access-token');
  });

  // -----------------------------------------------------------------------
  // 3. ForbiddenException — email linked to different Google account
  // -----------------------------------------------------------------------
  it('throws ForbiddenException when email is linked to a different Google account', async () => {
    const existing = makeExistingUser({ googleId: 'other-google-id' });
    const profile = makeProfile({ googleId: 'google-123' });
    userRepo.findByEmail.mockResolvedValue(existing);

    await expect(service.handleGoogleAuth(profile)).rejects.toThrow(ForbiddenException);
    await expect(service.handleGoogleAuth(profile)).rejects.toThrow('auth.ACCOUNT_LINKED_TO_OTHER');
  });

  // -----------------------------------------------------------------------
  // 4. ForbiddenException — existing user is locked/inactive
  // -----------------------------------------------------------------------
  it('throws ForbiddenException when existing user is locked', async () => {
    const existing = makeExistingUser({ status: 'locked', googleId: 'google-123' });
    const profile = makeProfile({ googleId: 'google-123' });
    userRepo.findByEmail.mockResolvedValue(existing);

    await expect(service.handleGoogleAuth(profile)).rejects.toThrow(ForbiddenException);
    await expect(service.handleGoogleAuth(profile)).rejects.toThrow('auth.ACCOUNT_LOCKED');
  });

  // -----------------------------------------------------------------------
  // 5. Resolves full name from firstName + lastName
  // -----------------------------------------------------------------------
  it('resolves full name from firstName and lastName', async () => {
    const existing = makeExistingUser({ googleId: null });
    const profile = makeProfile({ firstName: 'Jane', lastName: 'Smith' });
    userRepo.findByEmail.mockResolvedValue(existing);
    userRepo.update.mockResolvedValue(existing);

    await service.handleGoogleAuth(profile);

    expect(userRepo.update).toHaveBeenCalledWith(
      existing.id,
      expect.objectContaining({ name: 'Jane Smith' }),
    );
  });

  // -----------------------------------------------------------------------
  // 6. Uses email prefix as name fallback
  // -----------------------------------------------------------------------
  it('uses email prefix as name fallback when firstName and lastName are absent', async () => {
    const existing = makeExistingUser({ googleId: null });
    const profile = makeProfile({ firstName: undefined, lastName: undefined });
    userRepo.findByEmail.mockResolvedValue(existing);
    userRepo.update.mockResolvedValue(existing);

    await service.handleGoogleAuth(profile);

    expect(userRepo.update).toHaveBeenCalledWith(
      existing.id,
      expect.objectContaining({ name: 'John' }),
    );
  });

  // -----------------------------------------------------------------------
  // 7. Retries on P2002 username collision
  // -----------------------------------------------------------------------
  it('retries on P2002 username collision and succeeds', async () => {
    const profile = makeProfile();
    const createdUser = makeExistingUser({ username: 'john_retry' });

    userRepo.findByEmail.mockResolvedValue(null);
    userRepo.enqueueOutboxEvent.mockResolvedValue(undefined);

    // First call throws P2002, second call succeeds
    let callCount = 0;
    userRepo.withTransaction.mockImplementation(async (fn: Function) => {
      callCount++;
      if (callCount === 1) {
        throw new (Prisma.PrismaClientKnownRequestError as any)('Unique constraint', {
          code: 'P2002',
          clientVersion: '5.0.0',
        });
      }
      return fn('tx');
    });
    userRepo.create.mockResolvedValue(createdUser);

    const result = await service.handleGoogleAuth(profile);

    expect(callCount).toBe(2);
    expect(result.token).toBe('access-token');
  });

  // -----------------------------------------------------------------------
  // 8. ConflictException after 6 failed username attempts
  // -----------------------------------------------------------------------
  it('throws ConflictException after 6 failed username generation attempts', async () => {
    const profile = makeProfile();

    userRepo.findByEmail.mockResolvedValue(null);
    userRepo.withTransaction.mockRejectedValue(
      new (Prisma.PrismaClientKnownRequestError as any)('Unique constraint', {
        code: 'P2002',
        clientVersion: '5.0.0',
      }),
    );

    await expect(service.handleGoogleAuth(profile)).rejects.toThrow(ConflictException);
    await expect(service.handleGoogleAuth(profile)).rejects.toThrow(
      'auth.USERNAME_GENERATION_FAILED',
    );
    // 6 attempts per call
    expect(userRepo.withTransaction).toHaveBeenCalledTimes(12); // 6 per each of the 2 calls
  });
});
