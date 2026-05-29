import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { RbacGuard } from '../../src/guards/rbac.guard';
import { PERMS_KEY } from '../../src/decorators/permission.decorator';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type ReflectorStub = {
  getAllAndOverride: jest.Mock;
};

type ConfigStub = {
  get: jest.Mock;
};

type RedisStub = {
  isEnabled: jest.Mock;
  hgetall: jest.Mock;
  get: jest.Mock;
  set: jest.Mock;
  getOrSet: jest.Mock;
};

function buildReflector(perms: string[] | undefined): ReflectorStub {
  return { getAllAndOverride: jest.fn().mockReturnValue(perms) };
}

function buildConfig(map: Record<string, any> = {}): ConfigStub {
  return { get: jest.fn((key: string) => map[key]) };
}

function buildRedis(overrides: Partial<RedisStub> = {}): RedisStub {
  // Default getOrSet: if cache has a value (via .get), return it; otherwise
  // call the factory and remember the result via .set. Tests that need
  // specific cache behavior should override .get / .getOrSet directly.
  const stub: RedisStub = {
    isEnabled: jest.fn().mockReturnValue(true),
    hgetall: jest.fn().mockResolvedValue({ version: '1' }),
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
    getOrSet: jest.fn().mockImplementation(async (key, factory, ttl) => {
      const cached = await stub.get(key);
      if (cached !== null && cached !== undefined) {
        return JSON.parse(cached);
      }
      const fresh = await factory();
      await stub.set(key, JSON.stringify(fresh), ttl);
      return fresh;
    }),
    ...overrides,
  };
  return stub;
}

function buildContext(req: any): any {
  return {
    switchToHttp: () => ({ getRequest: () => req }),
    getHandler: () => undefined,
    getClass: () => undefined,
  };
}

function mockFetchOk(body: { allowed: boolean }) {
  return jest.fn().mockResolvedValue({
    ok: true,
    json: async () => body,
  });
}

/** Stub the GET /internal/rbac/effective response. */
function mockFetchEffective(permissions: string[]) {
  return jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ permissions }),
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('RbacGuard', () => {
  const originalFetch = global.fetch;
  const originalEnv = process.env.NODE_ENV;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    process.env.NODE_ENV = originalEnv;
  });

  it('cho qua khi route khong co @Permission decorator', async () => {
    const guard = new RbacGuard(buildReflector(undefined) as any, buildConfig() as any);
    await expect(
      guard.canActivate(buildContext({ user: { sub: '1' } })),
    ).resolves.toBe(true);
  });

  it('cho qua route public/internal khong can goi IAM', async () => {
    const guard = new RbacGuard(buildReflector(['public']) as any, buildConfig() as any);
    await expect(
      guard.canActivate(buildContext({ user: undefined })),
    ).resolves.toBe(true);
  });

  it('reject khi request khong co user.sub', async () => {
    const guard = new RbacGuard(buildReflector(['user.manage']) as any, buildConfig() as any);
    await expect(
      guard.canActivate(buildContext({ user: undefined })),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  describe('@Authenticated() — chi can JWT, khong call IAM', () => {
    it('cho qua khi user co sub, khong cau hinh IAM van OK', async () => {
      global.fetch = jest.fn();
      const guard = new RbacGuard(
        buildReflector(['authenticated']) as any,
        buildConfig() as any,
      );
      await expect(
        guard.canActivate(buildContext({ user: { sub: '42' } })),
      ).resolves.toBe(true);
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('reject khi chua dang nhap (no user.sub)', async () => {
      const guard = new RbacGuard(
        buildReflector(['authenticated']) as any,
        buildConfig() as any,
      );
      await expect(
        guard.canActivate(buildContext({ user: undefined })),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe('dev-mode bypass khi thieu IAM_INTERNAL_URL', () => {
    it('chi cho qua khi NODE_ENV === "development"', async () => {
      process.env.NODE_ENV = 'development';
      const guard = new RbacGuard(
        buildReflector(['user.manage']) as any,
        buildConfig() as any,
      );
      await expect(
        guard.canActivate(buildContext({ user: { sub: '1' } })),
      ).resolves.toBe(true);
    });

    it('fail-closed khi NODE_ENV === "production"', async () => {
      process.env.NODE_ENV = 'production';
      const guard = new RbacGuard(
        buildReflector(['user.manage']) as any,
        buildConfig() as any,
      );
      await expect(
        guard.canActivate(buildContext({ user: { sub: '1' } })),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('fail-closed khi NODE_ENV === "staging" (khong phai "development")', async () => {
      process.env.NODE_ENV = 'staging';
      const guard = new RbacGuard(
        buildReflector(['user.manage']) as any,
        buildConfig() as any,
      );
      await expect(
        guard.canActivate(buildContext({ user: { sub: '1' } })),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('fail-closed khi NODE_ENV undefined', async () => {
      delete process.env.NODE_ENV;
      const guard = new RbacGuard(
        buildReflector(['user.manage']) as any,
        buildConfig() as any,
      );
      await expect(
        guard.canActivate(buildContext({ user: { sub: '1' } })),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('IAM call + caching', () => {
    const config = { IAM_INTERNAL_URL: 'http://iam:3002/api/iam', INTERNAL_API_SECRET: 's' };

    it('goi IAM /effective va cho qua khi user co quyen can thiet', async () => {
      global.fetch = mockFetchEffective(['user.manage', 'user.view']);
      const redis = buildRedis();
      const guard = new RbacGuard(
        buildReflector(['user.manage']) as any,
        buildConfig(config) as any,
        redis as any,
      );
      await expect(
        guard.canActivate(buildContext({ user: { sub: '42' } })),
      ).resolves.toBe(true);
      expect(global.fetch).toHaveBeenCalledTimes(1);
      const calledUrl = (global.fetch as jest.Mock).mock.calls[0][0];
      expect(calledUrl).toContain('/internal/rbac/effective?userId=42');
      // Cache key: per-user (not per perm-tuple).
      expect(redis.set).toHaveBeenCalledWith(
        expect.stringMatching(/^rbac:guard:v1:u:42$/),
        expect.any(String),
        expect.any(Number),
      );
    });

    it('cache key include version tu rbac:meta', async () => {
      global.fetch = mockFetchEffective(['user.manage']);
      const redis = buildRedis({
        hgetall: jest.fn().mockResolvedValue({ version: '7' }),
      });
      const guard = new RbacGuard(
        buildReflector(['user.manage']) as any,
        buildConfig(config) as any,
        redis as any,
      );
      await guard.canActivate(buildContext({ user: { sub: '42' } }));
      expect(redis.set).toHaveBeenCalledWith(
        expect.stringMatching(/^rbac:guard:v7:u:42$/),
        expect.any(String),
        expect.any(Number),
      );
    });

    it('su dung cache khi co hit, khong goi IAM', async () => {
      global.fetch = jest.fn();
      const redis = buildRedis({
        get: jest.fn().mockResolvedValue(JSON.stringify(['user.manage'])),
      });
      const guard = new RbacGuard(
        buildReflector(['user.manage']) as any,
        buildConfig(config) as any,
        redis as any,
      );
      await expect(
        guard.canActivate(buildContext({ user: { sub: '42' } })),
      ).resolves.toBe(true);
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('cache 1 entry per user duoc dung lai cho moi tuple perm khac nhau', async () => {
      // Same user, two different route guards — should hit the cache the
      // second time around because the key only depends on userId.
      global.fetch = mockFetchEffective(['user.manage', 'role.manage']);
      const redis = buildRedis();
      const ctx = buildContext({ user: { sub: '7' } });

      const g1 = new RbacGuard(
        buildReflector(['user.manage']) as any,
        buildConfig(config) as any,
        redis as any,
      );
      await g1.canActivate(ctx);
      // Seed the cache for the second guard
      (redis.get as jest.Mock).mockResolvedValueOnce(
        JSON.stringify(['user.manage', 'role.manage']),
      );

      const g2 = new RbacGuard(
        buildReflector(['role.manage']) as any,
        buildConfig(config) as any,
        redis as any,
      );
      await g2.canActivate(ctx);
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('throw Forbidden khi user khong co bat ki required perm nao', async () => {
      global.fetch = mockFetchEffective(['user.view']);
      const guard = new RbacGuard(
        buildReflector(['user.manage']) as any,
        buildConfig(config) as any,
        buildRedis() as any,
      );
      await expect(
        guard.canActivate(buildContext({ user: { sub: '42' } })),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('treat IAM 4xx as deny (empty effective set)', async () => {
      global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 403, json: async () => ({}) });
      const guard = new RbacGuard(
        buildReflector(['user.manage']) as any,
        buildConfig(config) as any,
        buildRedis() as any,
      );
      await expect(
        guard.canActivate(buildContext({ user: { sub: '42' } })),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('any-of semantics: cho qua neu user co bat ki 1 perm trong list required', async () => {
      global.fetch = mockFetchEffective(['comic.view']);
      const guard = new RbacGuard(
        buildReflector(['user.manage', 'comic.view']) as any,
        buildConfig(config) as any,
        buildRedis() as any,
      );
      await expect(
        guard.canActivate(buildContext({ user: { sub: '42' } })),
      ).resolves.toBe(true);
    });

    it('Redis tat van hoat dong (khong cache, van goi IAM)', async () => {
      global.fetch = mockFetchEffective(['user.manage']);
      const redis = buildRedis({ isEnabled: jest.fn().mockReturnValue(false) });
      const guard = new RbacGuard(
        buildReflector(['user.manage']) as any,
        buildConfig(config) as any,
        redis as any,
      );
      await expect(
        guard.canActivate(buildContext({ user: { sub: '1' } })),
      ).resolves.toBe(true);
    });

    it('khong co redis (undefined) van hoat dong', async () => {
      global.fetch = mockFetchEffective(['user.manage']);
      const guard = new RbacGuard(
        buildReflector(['user.manage']) as any,
        buildConfig(config) as any,
      );
      await expect(
        guard.canActivate(buildContext({ user: { sub: '1' } })),
      ).resolves.toBe(true);
    });
  });

  it('PERMS_KEY duoc dung khi reflect metadata', () => {
    const reflector = buildReflector(['x']);
    new RbacGuard(reflector as any, buildConfig() as any).canActivate(
      buildContext({ user: { sub: '1' } }),
    ).catch(() => {});
    expect(reflector.getAllAndOverride).toHaveBeenCalledWith(PERMS_KEY, expect.any(Array));
  });
});
