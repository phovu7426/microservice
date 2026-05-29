import { JsonLogger } from '../src/json-logger';

const ENV_BACKUP = { ...process.env };
afterEach(() => { process.env = { ...ENV_BACKUP }; });

function captureStdout(fn: () => void): string[] {
  const lines: string[] = [];
  const orig = process.stdout.write;
  // @ts-expect-error spy assignment
  process.stdout.write = (chunk: any) => {
    lines.push(typeof chunk === 'string' ? chunk : chunk.toString());
    return true;
  };
  try { fn(); } finally { process.stdout.write = orig; }
  return lines;
}

describe('JsonLogger', () => {
  describe('production mode', () => {
    beforeEach(() => { process.env.NODE_ENV = 'production'; });

    it('emits one JSON object per line', () => {
      const logger = new JsonLogger('auth-service');
      const lines = captureStdout(() => logger.log('hello', 'TestCtx'));
      expect(lines).toHaveLength(1);
      const parsed = JSON.parse(lines[0]);
      expect(parsed).toMatchObject({
        level: 'info',
        service: 'auth-service',
        context: 'TestCtx',
        msg: 'hello',
      });
      expect(parsed.ts).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it('includes stack trace on error', () => {
      const logger = new JsonLogger('auth-service');
      const lines = captureStdout(() => logger.error('boom', 'Error: stack here\n  at foo', 'Ctx'));
      const parsed = JSON.parse(lines[0]);
      expect(parsed.level).toBe('error');
      expect(parsed.stack).toContain('stack here');
    });

    it('serializes object messages safely', () => {
      const logger = new JsonLogger('svc');
      const lines = captureStdout(() => logger.log({ foo: 'bar' }));
      expect(JSON.parse(lines[0]).msg).toBe('{"foo":"bar"}');
    });

    it('does not throw on circular references in message', () => {
      const logger = new JsonLogger('svc');
      const circ: any = { name: 'a' };
      circ.self = circ;
      const lines = captureStdout(() => logger.log(circ));
      expect(lines).toHaveLength(1);
      const parsed = JSON.parse(lines[0]);
      expect(typeof parsed.msg).toBe('string');
    });

    it('extracts message + stack from a raw Error (Error fields are non-enumerable)', () => {
      const logger = new JsonLogger('svc');
      const err = new Error('something broke');
      const lines = captureStdout(() => logger.error(err as any, undefined, 'ExceptionHandler'));
      const parsed = JSON.parse(lines[0]);
      expect(parsed.msg).toBe('something broke');           // not '{}' anymore
      expect(parsed.stack).toContain('something broke');
      expect(parsed.context).toBe('ExceptionHandler');
    });
  });

  describe('development mode', () => {
    beforeEach(() => { process.env.NODE_ENV = 'development'; });

    it('does NOT emit JSON to stdout (uses ConsoleLogger pretty format)', () => {
      const logger = new JsonLogger('svc');
      // Spy ConsoleLogger.prototype.log via captureStdout — it goes to stdout
      // too but isn't a JSON line. Easier check: no captured line is parseable
      // JSON containing our shape.
      const lines = captureStdout(() => logger.log('hello'));
      const parsed = lines.map((l) => { try { return JSON.parse(l); } catch { return null; } });
      const ourShape = parsed.find((p) => p && p.level === 'info' && p.service === 'svc');
      expect(ourShape).toBeUndefined();
    });
  });
});
