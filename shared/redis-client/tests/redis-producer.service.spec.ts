// jest.mock must come before any imports that use ioredis
jest.mock('ioredis');

import Redis from 'ioredis';
import { RedisProducerService } from '../src/redis-producer.service';

const MockRedis = Redis as jest.MockedClass<typeof Redis>;

function makeService(optionOverrides: Record<string, any> = {}) {
  const mockXadd = jest.fn().mockResolvedValue('1234-0');
  const mockPing = jest.fn().mockResolvedValue('PONG');
  const mockQuit = jest.fn().mockResolvedValue('OK');
  const mockConnect = jest.fn().mockResolvedValue(undefined);
  const mockOn = jest.fn();

  MockRedis.mockImplementation(() => ({
    xadd: mockXadd,
    ping: mockPing,
    quit: mockQuit,
    connect: mockConnect,
    on: mockOn,
  } as any));

  const service = new RedisProducerService({
    url: 'redis://localhost:6379',
    streamMaxLen: 10_000,
    ...optionOverrides,
  });

  return { service, mockXadd, mockPing, mockQuit, mockConnect, mockOn };
}

describe('RedisProducerService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ─── send() ──────────────────────────────────────────────────────────────────

  describe('send()', () => {
    it('calls xadd with correct stream key events:{topic}', async () => {
      const { service, mockXadd } = makeService();

      await service.send({
        topic: 'user.registered',
        messages: [{ value: JSON.stringify({ userId: '1' }) }],
      });

      expect(mockXadd).toHaveBeenCalledTimes(1);
      expect(mockXadd.mock.calls[0][0]).toBe('events:user.registered');
    });

    it('calls xadd N times for N messages in a batch', async () => {
      const { service, mockXadd } = makeService();

      await service.send({
        topic: 'user.registered',
        messages: [
          { value: JSON.stringify({ userId: '1' }) },
          { value: JSON.stringify({ userId: '2' }) },
        ],
      });

      expect(mockXadd).toHaveBeenCalledTimes(2);
    });

    it('includes MAXLEN ~ 10000 in xadd args', async () => {
      const { service, mockXadd } = makeService();

      await service.send({
        topic: 'user.registered',
        messages: [{ value: 'test' }],
      });

      const args: string[] = mockXadd.mock.calls[0];
      expect(args).toContain('MAXLEN');
      expect(args).toContain('~');
      expect(args).toContain('10000');
    });

    it('serializes headers as JSON string in xadd fields', async () => {
      const { service, mockXadd } = makeService();

      await service.send({
        topic: 'mail.send',
        messages: [
          {
            value: JSON.stringify({ to: 'a@b.com' }),
            headers: { 'event-id': '99' },
          },
        ],
      });

      const args: string[] = mockXadd.mock.calls[0];
      const headersIdx = args.indexOf('headers');
      expect(headersIdx).toBeGreaterThan(-1);
      expect(args[headersIdx + 1]).toBe('{"event-id":"99"}');
    });

    it('retries up to 3 times on xadd failure then throws', async () => {
      const { service, mockXadd } = makeService();
      mockXadd.mockRejectedValue(new Error('connection lost'));

      // Allow the test to run for up to 10s; actual wall-time is ~1.4s
      // (3 retries × exponential back-off: 200ms + 400ms + 800ms)
      await expect(
        service.send({
          topic: 'user.registered',
          messages: [{ value: 'test' }],
        }),
      ).rejects.toThrow('connection lost');

      // 1 initial attempt + 3 retries = 4 total xadd calls
      expect(mockXadd).toHaveBeenCalledTimes(4);
    }, 10_000);

    it('is a no-op when enabled=false', async () => {
      const { service, mockXadd } = makeService({ enabled: false });

      await expect(
        service.send({
          topic: 'user.registered',
          messages: [{ value: 'test' }],
        }),
      ).resolves.toBeUndefined();

      expect(mockXadd).not.toHaveBeenCalled();
    });

    it('uses empty string for missing key', async () => {
      const { service, mockXadd } = makeService();

      await service.send({
        topic: 'user.registered',
        messages: [{ value: 'test' }], // no key field
      });

      const args: string[] = mockXadd.mock.calls[0];
      const keyIdx = args.indexOf('key');
      expect(keyIdx).toBeGreaterThan(-1);
      expect(args[keyIdx + 1]).toBe('');
    });
  });

  // ─── isEnabled() ─────────────────────────────────────────────────────────────

  describe('isEnabled()', () => {
    it('returns true when enabled option is not set', () => {
      const { service } = makeService();
      expect(service.isEnabled()).toBe(true);
    });

    it('returns false when enabled: false', () => {
      const { service } = makeService({ enabled: false });
      expect(service.isEnabled()).toBe(false);
    });
  });

  // ─── emit() ──────────────────────────────────────────────────────────────────

  describe('emit()', () => {
    it('serializes payload to JSON and calls send()', async () => {
      const { service, mockXadd, mockConnect, mockOn } = makeService();

      // Connect first so the instance is fully initialised
      await service.onModuleInit();

      await service.emit('user.registered', { userId: '123' });

      expect(mockXadd).toHaveBeenCalledTimes(1);
      const args: string[] = mockXadd.mock.calls[0];
      const valueIdx = args.indexOf('value');
      expect(valueIdx).toBeGreaterThan(-1);
      expect(args[valueIdx + 1]).toBe(JSON.stringify({ userId: '123' }));
    });
  });

  // ─── ping() ──────────────────────────────────────────────────────────────────

  describe('ping()', () => {
    it('throws when not connected', async () => {
      const { service } = makeService();
      // Do NOT call onModuleInit — connected stays false
      await expect(service.ping()).rejects.toThrow(
        'Redis producer is not connected',
      );
    });

    it('calls client.ping() after connection', async () => {
      const { service, mockPing } = makeService();

      await service.onModuleInit();
      await service.ping();

      expect(mockPing).toHaveBeenCalledTimes(1);
    });

    it('returns void when enabled=false', async () => {
      const { service, mockPing } = makeService({ enabled: false });
      await expect(service.ping()).resolves.toBeUndefined();
      expect(mockPing).not.toHaveBeenCalled();
    });
  });

  // ─── lifecycle ───────────────────────────────────────────────────────────────

  describe('onModuleInit()', () => {
    it('does not call connect when enabled=false', async () => {
      const { service, mockConnect } = makeService({ enabled: false });
      await service.onModuleInit();
      expect(mockConnect).not.toHaveBeenCalled();
    });

    it('registers error and connect event listeners', async () => {
      const { service, mockOn } = makeService();
      await service.onModuleInit();
      const events = mockOn.mock.calls.map((c: string[]) => c[0]);
      expect(events).toContain('error');
      expect(events).toContain('connect');
    });
  });

  describe('onModuleDestroy()', () => {
    it('calls client.quit() on destroy', async () => {
      const { service, mockQuit } = makeService();
      await service.onModuleInit();
      await service.onModuleDestroy();
      expect(mockQuit).toHaveBeenCalledTimes(1);
    });

    it('does not call quit when enabled=false', async () => {
      const { service, mockQuit } = makeService({ enabled: false });
      await service.onModuleDestroy();
      expect(mockQuit).not.toHaveBeenCalled();
    });
  });
});
