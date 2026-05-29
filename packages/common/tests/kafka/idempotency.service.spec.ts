import { IdempotencyService } from '../../src/event/idempotency.service';

type MockRedis = {
  isEnabled: jest.Mock<boolean, []>;
  setnx: jest.Mock<Promise<boolean>, [string, string, number?]>;
  del: jest.Mock<Promise<void>, [string]>;
};

function makeRedis(overrides: Partial<MockRedis> = {}): MockRedis {
  return {
    isEnabled: jest.fn(() => true),
    setnx: jest.fn(async () => true),
    del: jest.fn(async () => undefined),
    ...overrides,
  };
}

describe('IdempotencyService', () => {
  describe('claim', () => {
    it('returns true when Redis claim succeeds (first replica)', async () => {
      const redis = makeRedis({ setnx: jest.fn(async () => true) });
      const svc = new IdempotencyService(redis as any);

      const got = await svc.claim('user.registered', '42');

      expect(got).toBe(true);
      expect(redis.setnx).toHaveBeenCalledWith('idem:user.registered:42', '1', 86_400);
    });

    it('returns false when key already exists (peer claimed it)', async () => {
      const redis = makeRedis({ setnx: jest.fn(async () => false) });
      const svc = new IdempotencyService(redis as any);

      const got = await svc.claim('user.registered', '42');

      expect(got).toBe(false);
    });

    it('honors a custom TTL', async () => {
      const redis = makeRedis();
      const svc = new IdempotencyService(redis as any);

      await svc.claim('mail.send', 'abc', 60);

      expect(redis.setnx).toHaveBeenCalledWith('idem:mail.send:abc', '1', 60);
    });

    it('fails OPEN (returns true) when Redis is disabled', async () => {
      const redis = makeRedis({ isEnabled: jest.fn(() => false) });
      const svc = new IdempotencyService(redis as any);

      const got = await svc.claim('user.registered', '42');

      expect(got).toBe(true);
      // Must not even attempt the call so we don't burn time on connection retries
      expect(redis.setnx).not.toHaveBeenCalled();
    });

    it('fails OPEN when Redis throws — handler stays correct via own idempotency', async () => {
      const redis = makeRedis({
        setnx: jest.fn(async () => { throw new Error('CONNREFUSED'); }),
      });
      const svc = new IdempotencyService(redis as any);

      const got = await svc.claim('user.registered', '42');

      expect(got).toBe(true);
    });
  });

  describe('release', () => {
    it('deletes the claim key', async () => {
      const redis = makeRedis();
      const svc = new IdempotencyService(redis as any);

      await svc.release('user.registered', '42');

      expect(redis.del).toHaveBeenCalledWith('idem:user.registered:42');
    });

    it('swallows redis errors — best-effort cleanup', async () => {
      const redis = makeRedis({
        del: jest.fn(async () => { throw new Error('boom'); }),
      });
      const svc = new IdempotencyService(redis as any);

      await expect(svc.release('user.registered', '42')).resolves.toBeUndefined();
    });
  });

  describe('tryLeaderLock', () => {
    it('acquires lock under a separate "lock:" namespace', async () => {
      const redis = makeRedis({ setnx: jest.fn(async () => true) });
      const svc = new IdempotencyService(redis as any);

      const got = await svc.tryLeaderLock('outbox-relay:authOutbox', 45);

      expect(got).toBe(true);
      expect(redis.setnx).toHaveBeenCalledWith('lock:outbox-relay:authOutbox', '1', 45);
    });

    it('returns false when another replica already holds the lock', async () => {
      const redis = makeRedis({ setnx: jest.fn(async () => false) });
      const svc = new IdempotencyService(redis as any);

      const got = await svc.tryLeaderLock('outbox-relay:authOutbox', 45);

      expect(got).toBe(false);
    });

    it('fails OPEN when Redis is disabled — SKIP LOCKED still protects correctness', async () => {
      const redis = makeRedis({ isEnabled: jest.fn(() => false) });
      const svc = new IdempotencyService(redis as any);

      const got = await svc.tryLeaderLock('outbox-relay:authOutbox', 45);

      expect(got).toBe(true);
    });
  });
});
