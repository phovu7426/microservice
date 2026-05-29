import { ConsoleLogger, LogLevel } from '@nestjs/common';
import { trace } from '@opentelemetry/api';
import * as fs from 'fs';
import * as path from 'path';

type Level = LogLevel | 'info' | 'fatal';

const LEVEL_PRIORITY: Record<string, number> = {
  fatal: 0,
  error: 1,
  warn: 2,
  info: 3,
  log: 3,
  debug: 4,
  verbose: 5,
};

/** NestJS internal contexts that produce noisy startup/routing logs */
const NOISY_CONTEXTS = new Set([
  'InstanceLoader',
  'RoutesResolver',
  'RouterExplorer',
  'NestFactory',
  'NestApplication',
]);

/**
 * Structured JSON logger with pluggable output targets.
 *
 * Env vars:
 *   LOG_TARGET  — comma-separated list of targets (default: 'console')
 *                 Supported: console, file
 *   LOG_DIR     — directory for log files (default: './logs')
 *   LOG_LEVEL   — minimum level (default: 'info')
 *
 * Examples:
 *   LOG_TARGET=console            → terminal only
 *   LOG_TARGET=file               → file only
 *   LOG_TARGET=file,console       → both
 *
 * File naming: `{serviceName}-{YYYY-MM-DD}.log`
 */
export class JsonLogger extends ConsoleLogger {
  private readonly serviceName: string;
  private readonly isProd: boolean;
  private readonly targets: Set<string>;
  private readonly logDir: string;
  private readonly minLevel: number;
  private currentDate: string = '';
  private fileStream: fs.WriteStream | null = null;

  constructor(serviceName: string) {
    super();
    this.serviceName = serviceName;
    this.isProd = process.env.NODE_ENV === 'production';

    const raw = process.env.LOG_TARGET?.trim()?.toLowerCase() || 'console';
    this.targets = new Set(raw.split(',').map((s) => s.trim()).filter(Boolean));

    this.logDir = process.env.LOG_DIR?.trim() || './logs';
    if (this.targets.has('file')) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }

    const envLevel = process.env.LOG_LEVEL?.trim()?.toLowerCase() || 'info';
    this.minLevel = LEVEL_PRIORITY[envLevel] ?? LEVEL_PRIORITY.info;
  }

  log(message: any, context?: string) {
    if (!this.shouldLog('info')) return;
    this.dispatch('info', message, context);
  }
  error(message: any, stack?: string, context?: string) {
    if (!this.shouldLog('error')) return;
    this.dispatch('error', message, context, stack);
  }
  warn(message: any, context?: string) {
    if (!this.shouldLog('warn')) return;
    this.dispatch('warn', message, context);
  }
  debug(message: any, context?: string) {
    if (!this.shouldLog('debug')) return;
    this.dispatch('debug', message, context);
  }
  verbose(message: any, context?: string) {
    if (!this.shouldLog('verbose')) return;
    this.dispatch('verbose', message, context);
  }
  fatal(message: any, context?: string) {
    if (!this.shouldLog('fatal')) return;
    this.dispatch('fatal', message, context);
  }

  private dispatch(level: Level, message: any, context?: string, stack?: string) {
    for (const target of this.targets) {
      switch (target) {
        case 'console':
          this.writeConsole(level, message, context, stack);
          break;
        case 'file':
          this.writeFile(level, message, context, stack);
          break;
        // Future targets: add cases here (e.g. 'syslog', 'loki', 'webhook')
      }
    }
  }

  private writeConsole(level: Level, message: any, context?: string, stack?: string) {
    if (this.isProd) {
      const record = this.buildRecord(level, message, context, stack);
      process.stdout.write(JSON.stringify(record) + '\n');
      return;
    }
    // Dev: pretty output via NestJS ConsoleLogger
    switch (level) {
      case 'error': super.error(message, stack, context); break;
      case 'warn':  super.warn(message, context); break;
      case 'debug': super.debug(message, context); break;
      case 'verbose': super.verbose(message, context); break;
      case 'fatal': {
        const parentFatal = (ConsoleLogger.prototype as any).fatal;
        if (typeof parentFatal === 'function') parentFatal.call(this, message, context);
        else super.error(message, undefined, context);
        break;
      }
      default: super.log(message, context); break;
    }
  }

  private writeFile(level: Level, message: any, context?: string, stack?: string) {
    // Skip noisy NestJS startup logs in file — only keep business & error logs
    const ctx = context ?? this.context ?? '';
    if (NOISY_CONTEXTS.has(ctx) && LEVEL_PRIORITY[level] >= LEVEL_PRIORITY.info) {
      return;
    }

    const today = new Date().toISOString().slice(0, 10);

    if (today !== this.currentDate) {
      this.fileStream?.end();
      const slug = this.serviceName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      const filePath = path.join(this.logDir, `${slug}-${today}.log`);
      this.fileStream = fs.createWriteStream(filePath, { flags: 'a' });
      this.currentDate = today;
    }

    const record = this.buildRecord(level, message, context, stack);
    this.fileStream!.write(JSON.stringify(record) + '\n');
  }

  private shouldLog(level: Level): boolean {
    const p = LEVEL_PRIORITY[level];
    return p !== undefined && p <= this.minLevel;
  }

  private buildRecord(level: Level, message: any, context?: string, stack?: string): Record<string, unknown> {
    const span = trace.getActiveSpan();
    const sc = span?.spanContext();
    const { msg, errStack } = stringifyMessage(message);

    const record: Record<string, unknown> = {
      ts: new Date().toISOString(),
      level,
      service: this.serviceName,
      context: context ?? this.context,
      msg,
    };

    if (sc?.traceId) record.trace_id = sc.traceId;
    if (sc?.spanId) record.span_id = sc.spanId;

    const finalStack = stack ?? errStack;
    if (finalStack) record.stack = finalStack;

    return record;
  }
}

function stringifyMessage(v: unknown): { msg: string; errStack?: string } {
  if (typeof v === 'string') return { msg: v };
  if (v instanceof Error) return { msg: v.message || v.name, errStack: v.stack };
  if (v && typeof v === 'object') {
    try { return { msg: JSON.stringify(v) }; }
    catch { return { msg: String(v) }; }
  }
  return { msg: String(v) };
}
