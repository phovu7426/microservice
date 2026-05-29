import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

/**
 * A single log session — accumulates debug steps & exceptions, then save() writes ONE JSON line.
 *
 * Usage:
 * ```typescript
 * const log = this.fileLogger.create('auth/register', { email, username });
 * try {
 *   log.addDebug('uniqueness validated');
 *   log.addDebug('OTP verified');
 *   const user = await this.createUser(dto);
 *   log.save({ userId: user.id });
 * } catch (err: any) {
 *   log.addException(err);
 * } finally {
 *   log.save(result);
 * }
 * ```
 */
export class LogSession {
  private readonly filePath: string;
  private readonly startTime: number;
  private readonly input: Record<string, unknown>;
  private readonly debug: Array<{ step: string; ts: string; elapsed_ms: number }>;
  private readonly exceptions: Array<Record<string, unknown>>;
  private readonly context: { user: string; ip: string; userAgent: string };
  private saved = false;

  constructor(
    filePath: string,
    input: Record<string, unknown>,
    context?: { user?: string; ip?: string; userAgent?: string },
  ) {
    this.filePath = filePath;
    this.startTime = Date.now();
    this.input = redact(input);
    this.debug = [];
    this.exceptions = [];
    this.context = {
      user: context?.user ?? 'guest',
      ip: context?.ip ?? '',
      userAgent: context?.userAgent ?? '',
    };
  }

  /** Add a debug step with automatic elapsed time */
  addDebug(step: string, extra?: Record<string, unknown>): this {
    this.debug.push({
      step: extra ? `${step} ${JSON.stringify(extra)}` : step,
      ts: new Date().toISOString(),
      elapsed_ms: Date.now() - this.startTime,
    });
    return this;
  }

  /** Add an exception — can be called multiple times */
  addException(err: any): this {
    const info: Record<string, unknown> = {};
    if (err instanceof Error) {
      info.errorMessage = err.message;
      info.errorFile = err.stack?.split('\n')[1]?.trim() ?? '';
      info.errorStack = err.stack;
      if ('code' in err) info.errorCode = (err as any).code;
    } else {
      info.errorMessage = String(err);
    }
    this.exceptions.push(info);
    return this;
  }

  /** Attach this session to request so other services can access it via FileLogger.fromReq(req) */
  attachToReq(req: any): this {
    req.__logSession = this;
    return this;
  }

  /** Save log — writes 1 JSON line. Safe to call multiple times (only first call writes). */
  save(output?: Record<string, unknown> | unknown): void {
    if (this.saved) return;
    this.saved = true;

    const record: Record<string, unknown> = {
      ts: new Date().toISOString(),
      user: this.context.user,
      ip: this.context.ip,
      userAgent: this.context.userAgent,
      input: this.input,
      debug: this.debug,
      duration_ms: Date.now() - this.startTime,
      isError: this.exceptions.length > 0 ? 1 : 0,
    };

    if (output != null) {
      record.output = redact(
        typeof output === 'object' && output !== null
          ? (output as Record<string, unknown>)
          : { value: output },
      );
    }

    if (this.exceptions.length) {
      record.exceptions = this.exceptions;
    }

    try {
      const dir = path.dirname(this.filePath);
      fs.mkdirSync(dir, { recursive: true });
      const json = JSON.stringify(record, (_key, value) =>
        typeof value === 'bigint' ? String(value) : value,
      );
      fs.appendFileSync(this.filePath, json + '\n');
    } catch (e) {
      try {
        const errDir = path.dirname(this.filePath);
        fs.appendFileSync(
          path.join(errDir, '_file-logger-errors.log'),
          `${new Date().toISOString()} | ${this.filePath} | ${(e as Error).message}\n`,
        );
      } catch { /* truly give up */ }
    }
  }
}

/**
 * Factory service — inject once, create log sessions per operation.
 *
 * ```typescript
 * constructor(private readonly fileLogger: FileLogger) {}
 *
 * async register(dto, req) {
 *   const log = this.fileLogger.create('auth/register', { email: dto.email }, req);
 *   try {
 *     log.addDebug('validating');
 *     const user = await this.createUser(dto);
 *     log.save({ userId: user.id });
 *   } catch (err: any) {
 *     log.addException(err);
 *     throw err;
 *   } finally {
 *     log.save();
 *   }
 * }
 * ```
 */
@Injectable()
export class FileLogger {
  private readonly baseDir: string;

  constructor() {
    this.baseDir = process.env.LOG_DIR?.trim() || './logs';
  }

  /**
   * Create a new log session.
   * @param filePath — relative path under LOG_DIR (e.g. 'auth/register')
   * @param input — request params (sensitive fields auto-redacted)
   * @param req — Express request (optional, extracts user/ip/userAgent + attaches session)
   */
  create(
    filePath: string,
    input: Record<string, unknown> = {},
    req?: any,
  ): LogSession {
    const today = new Date().toISOString().slice(0, 10);
    const fullPath = path.join(this.baseDir, `${filePath}-${today}.log`);

    const session = new LogSession(fullPath, input, {
      user: req?.user?.sub ?? req?.user?.id ?? 'guest',
      ip: req?.ip ?? req?.headers?.['x-forwarded-for'] ?? '',
      userAgent: req?.headers?.['user-agent'] ?? '',
    });

    // Auto-attach to request if provided, so downstream services can pick it up
    if (req) session.attachToReq(req);

    return session;
  }

  /**
   * Get the log session from request (created by an upstream service/controller).
   * Returns null if no session attached — caller should create a new one.
   */
  fromReq(req: any): LogSession | null {
    return req?.__logSession ?? null;
  }
}

const SENSITIVE_KEYS = [
  'password', 'newpassword', 'currentpassword', 'old_password',
  'confirmpassword', 'token', 'refreshtoken', 'accesstoken',
  'secret', 'apikey', 'pem', 'authorization', 'cookie',
  'otp', 'googleid', 'creditcard', 'ssn',
];

function redact(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (SENSITIVE_KEYS.some((s) => k.toLowerCase().includes(s))) {
      out[k] = '[REDACTED]';
    } else if (v && typeof v === 'object' && !(v instanceof Date) && !Array.isArray(v)) {
      out[k] = redact(v as Record<string, unknown>);
    } else {
      out[k] = v;
    }
  }
  return out;
}
