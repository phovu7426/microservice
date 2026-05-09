import { ConfigService } from '@nestjs/config';
import { RedisService } from '../src/redis.service';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type MockClient = {
  get: jest.Mock;
  set: jest.Mock;
  eval: jest.Mock;
};

function makeClient(overrides: Partial<MockClient> = {}): MockClient {
  return {
    get: jest.fn(async () => null),
    set: jest.fn(async () => 'OK'),
    eval: jest.fn(async () => 1),
    ...overrides,
  };
}

function makeService(clientOverrides: Partial<MockClient> = {}) {
  const config = { get: jest.fn() } as unknown as ConfigService;
  const svc = new RedisService(config);
  const mockClient = makeClient(clientOverrides);
  (svc as any).client = mockClient;
  (svc as any).enabled = true;
  return { svc, mockClient };
}

function makeDisabledService() {
  const config = { get: jest.fn() } as unknown as ConfigService;
  const svc = new RedisService(config);
  // Leave client as null and enabled as false (default state)
  return { svc };
}

// ---------------------------------------------------------------------------
// acquireLock
// ---------------------------------------------------------------------------

describe('RedisService.acquireLock', () => {
  it('returns true when client.set returns "OK"', async () => {
    const { svc, mockClient } = makeService({ set: jest.fn(async () => 'OK') });

    const result = await svc.acquireLock('lock:foo', 'token-abc', 10);

    expect(result).toBe(true);
    expect(mockClient.set).toHaveBeenCalledWith('lock:foo', 'token-abc', 'EX', 10, 'NX');
  });

  it('returns false when client.set returns null (key already exists)', async () => {
    const { svc, mockClient } = makeService({ set: jest.fn(async () => null) });

    const result = await svc.acquireLock('lock:foo', 'token-abc', 10);

    expect(result).toBe(false);
    expect(mockClient.set).toHaveBeenCalledTimes(1);
  });

  it('returns false when Redis is disabled (client is null)', async () => {
    const { svc } = makeDisabledService();

    const result = await svc.acquireLock('lock:foo', 'token-abc', 10);

    expect(result).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// releaseLock
// ---------------------------------------------------------------------------

describe('RedisService.releaseLock', () => {
  it('returns true when Lua script returns 1 (token matched, key deleted)', async () => {
    const { svc, mockClient } = makeService({ eval: jest.fn(async () => 1) });

    const result = await svc.releaseLock('lock:foo', 'token-abc');

    expect(result).toBe(true);
    // First arg is the Lua script, then 1 (numkeys), then key + token
    expect(mockClient.eval).toHaveBeenCalledWith(
      expect.any(String),
      1,
      'lock:foo',
      'token-abc',
    );
  });

  it('returns false when Lua script returns 0 (token mismatch)', async () => {
    const { svc } = makeService({ eval: jest.fn(async () => 0) });

    const result = await svc.releaseLock('lock:foo', 'wrong-token');

    expect(result).toBe(false);
  });

  it('returns false when Redis is disabled (client is null)', async () => {
    const { svc } = makeDisabledService();

    const result = await svc.releaseLock('lock:foo', 'token-abc');

    expect(result).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// getOrSet
// ---------------------------------------------------------------------------

describe('RedisService.getOrSet', () => {
  it('cache hit — returns parsed value without calling factory', async () => {
    const cached = { id: 1, name: 'comic' };
    const { svc, mockClient } = makeService({
      get: jest.fn(async () => JSON.stringify(cached)),
    });
    const factory = jest.fn(async () => ({ id: 2, name: 'other' }));

    const result = await svc.getOrSet('key:1', factory, 60);

    expect(result).toEqual(cached);
    expect(factory).not.toHaveBeenCalled();
    expect(mockClient.set).not.toHaveBeenCalled();
  });

  it('cache miss + Redis disabled — calls factory, does not set cache', async () => {
    const { svc } = makeDisabledService();
    const value = { id: 42 };
    const factory = jest.fn(async () => value);

    const result = await svc.getOrSet('key:1', factory, 60);

    expect(result).toBe(value);
    expect(factory).toHaveBeenCalledTimes(1);
  });

  it('cache miss — calls factory once, sets cache with correct TTL', async () => {
    const { svc, mockClient } = makeService({
      get: jest.fn(async () => null),
      set: jest.fn(async () => 'OK'),
    });
    const value = { id: 99, title: 'Dragon Ball' };
    const factory = jest.fn(async () => value);

    const result = await svc.getOrSet('key:comics', factory, 120);

    expect(result).toEqual(value);
    expect(factory).toHaveBeenCalledTimes(1);
    expect(mockClient.set).toHaveBeenCalledWith(
      'key:comics',
      JSON.stringify(value),
      'EX',
      120,
    );
  });

  it('concurrent requests with same key — factory called only once (inflight dedup)', async () => {
    let resolveFactory!: (v: { id: number }) => void;
    const factoryPromise = new Promise<{ id: number }>((res) => {
      resolveFactory = res;
    });
    const factory = jest.fn(() => factoryPromise);

    const { svc } = makeService({ get: jest.fn(async () => null) });

    // Fire two concurrent requests for the same key
    const [p1, p2] = await Promise.all([
      // Start both before resolving factory
      (async () => {
        const r1 = svc.getOrSet('key:same', factory, 60);
        const r2 = svc.getOrSet('key:same', factory, 60);
        resolveFactory({ id: 7 });
        return Promise.all([r1, r2]);
      })(),
    ]);

    const [res1, res2] = p1;
    expect(factory).toHaveBeenCalledTimes(1);
    expect(res1).toEqual({ id: 7 });
    expect(res2).toEqual({ id: 7 });
  });

  it('inflightMap.size >= 1000 — clears map before adding new entry (no memory leak)', async () => {
    const { svc } = makeService({ get: jest.fn(async () => null) });
    const inflightMap: Map<string, Promise<any>> = (svc as any).inflightMap;

    // Fill up to 1000 entries with dummy pending promises
    for (let i = 0; i < 1000; i++) {
      inflightMap.set(`dummy:${i}`, Promise.resolve(i));
    }
    expect(inflightMap.size).toBe(1000);

    const factory = jest.fn(async () => 'value');
    await svc.getOrSet('new:key', factory, 30);

    // After clearing (size >= 1000) and inserting the new key, old entries are gone
    // The new key should have been processed and removed from inflightMap by .finally()
    // Map was cleared before 'new:key' was added
    expect(inflightMap.has('dummy:0')).toBe(false);
    expect(factory).toHaveBeenCalledTimes(1);
  });

  it('BigInt in result is serialized as Number in cache', async () => {
    const { svc, mockClient } = makeService({
      get: jest.fn(async () => null),
      set: jest.fn(async () => 'OK'),
    });
    const valueWithBigInt = { id: BigInt(9007199254740993), title: 'test' };
    const factory = jest.fn(async () => valueWithBigInt);

    await svc.getOrSet('key:bigint', factory, 60);

    const setCall = mockClient.set.mock.calls[0];
    const serialized = setCall[1] as string;
    const parsed = JSON.parse(serialized);
    // BigInt 9007199254740993n gets converted to Number via (_, v) => Number(v)
    expect(typeof parsed.id).toBe('number');
    expect(parsed.title).toBe('test');
  });

  it('client.get throwing an error — falls through to factory (graceful degradation)', async () => {
    const { svc, mockClient } = makeService({
      get: jest.fn(async () => { throw new Error('Redis timeout'); }),
      set: jest.fn(async () => 'OK'),
    });
    const value = { id: 1 };
    const factory = jest.fn(async () => value);

    const result = await svc.getOrSet('key:error', factory, 60);

    expect(result).toBe(value);
    expect(factory).toHaveBeenCalledTimes(1);
    // Cache write should still be attempted after factory succeeds
    expect(mockClient.set).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// getOrSetWithLock
// ---------------------------------------------------------------------------

describe('RedisService.getOrSetWithLock', () => {
  it('cache hit before acquiring lock — returns immediately without lock', async () => {
    const cached = { id: 5, title: 'One Piece' };
    const { svc, mockClient } = makeService({
      get: jest.fn(async () => JSON.stringify(cached)),
      set: jest.fn(async () => 'OK'),
    });
    const factory = jest.fn(async () => ({ id: 99 }));

    const result = await svc.getOrSetWithLock('key:hit', factory, 60);

    expect(result).toEqual(cached);
    expect(factory).not.toHaveBeenCalled();
    // Lock should never be acquired if cache was hit
    expect(mockClient.set).not.toHaveBeenCalled();
  });

  it('lock acquired — calls factory, caches result, releases lock', async () => {
    // get returns null (cache miss), set first call = 'OK' (lock acquired)
    const setCalls: Array<IArguments | unknown[]> = [];
    const mockSet = jest.fn(async (...args: unknown[]) => {
      setCalls.push(args);
      return 'OK';
    });
    const mockGet = jest.fn(async () => null);
    const mockEval = jest.fn(async () => 1); // releaseLock returns true

    const { svc } = makeService({ get: mockGet, set: mockSet, eval: mockEval });
    const value = { id: 10 };
    const factory = jest.fn(async () => value);

    const result = await svc.getOrSetWithLock('key:miss', factory, 60, 10);

    expect(result).toBe(value);
    expect(factory).toHaveBeenCalledTimes(1);

    // Verify lock was acquired: set(lockKey, token, 'EX', 10, 'NX')
    const lockAcquireCall = mockSet.mock.calls.find(
      (args) => args[0] === 'lock:key:miss' && args[4] === 'NX',
    );
    expect(lockAcquireCall).toBeDefined();

    // Verify cache was set: set(key, json, 'EX', ttl)
    const cacheSetCall = mockSet.mock.calls.find(
      (args) => args[0] === 'key:miss' && args[2] === 'EX',
    );
    expect(cacheSetCall).toBeDefined();

    // Verify lock was released via eval (Lua script)
    expect(mockEval).toHaveBeenCalledWith(
      expect.any(String),
      1,
      'lock:key:miss',
      expect.any(String),
    );
  });

  it('lock not acquired — waits 50ms then reads cache populated by lock holder', async () => {
    jest.useFakeTimers();

    let getCallCount = 0;
    const cachedByOther = { id: 20 };

    // First get call = cache miss, second get call (after 50ms wait) = cache hit
    const mockGet = jest.fn(async () => {
      getCallCount++;
      if (getCallCount >= 2) return JSON.stringify(cachedByOther);
      return null;
    });

    // Lock acquisition fails (another instance holds it)
    const mockSet = jest.fn(async (...args: unknown[]) => {
      if (args[4] === 'NX') return null; // lock not acquired
      return 'OK';
    });

    const { svc } = makeService({ get: mockGet, set: mockSet });
    const factory = jest.fn(async () => ({ id: 99 }));

    const resultPromise = svc.getOrSetWithLock('key:contended', factory, 60, 10);

    // Advance past the 50ms setTimeout and let pending microtasks flush
    await jest.advanceTimersByTimeAsync(100);

    const result = await resultPromise;

    expect(result).toEqual(cachedByOther);
    expect(factory).not.toHaveBeenCalled();

    jest.useRealTimers();
  });

  it('factory throws — lock is still released in finally block', async () => {
    const mockGet = jest.fn(async () => null);
    // Lock acquired successfully
    const mockSet = jest.fn(async (...args: unknown[]) => {
      if (args[4] === 'NX') return 'OK';
      return 'OK';
    });
    const mockEval = jest.fn(async () => 1);

    const { svc } = makeService({ get: mockGet, set: mockSet, eval: mockEval });
    const factory = jest.fn(async () => { throw new Error('source unavailable'); });

    await expect(svc.getOrSetWithLock('key:throws', factory, 60, 10)).rejects.toThrow(
      'source unavailable',
    );

    // Lock must be released even though factory threw
    expect(mockEval).toHaveBeenCalledWith(
      expect.any(String),
      1,
      'lock:key:throws',
      expect.any(String),
    );
  });
});
