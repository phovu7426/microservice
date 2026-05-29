import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { Observable, tap, catchError, throwError } from 'rxjs';

/**
 * Logs every HTTP request with full context.
 *
 * Captured per request:
 *   - user:        userId from JWT (or 'anonymous')
 *   - ip:          client IP (respects x-forwarded-for)
 *   - method:      GET, POST, etc.
 *   - url:         full request path with query string
 *   - route:       matched route pattern (e.g. /api/auth/login)
 *   - params:      URL params (e.g. { id: '1' })
 *   - body:        request body (sensitive fields redacted)
 *   - status:      HTTP status code
 *   - duration_ms: response time in milliseconds
 *   - user_agent:  client user-agent
 *   - request_id:  correlation ID
 *   - error:       error message + stack (only on failure)
 *
 * Register as APP_INTERCEPTOR in AppModule.
 */
@Injectable()
export class RequestLoggerInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req: any = ctx.switchToHttp().getRequest();
    const res: any = ctx.switchToHttp().getResponse();
    const startedAt = Date.now();

    return next.handle().pipe(
      tap(() => {
        this.emit(req, res, startedAt);
      }),
      catchError((err) => {
        this.emit(req, res, startedAt, err);
        return throwError(() => err);
      }),
    );
  }

  private emit(req: any, res: any, startedAt: number, err?: any) {
    const durationMs = Date.now() - startedAt;
    const status = err?.status ?? err?.getStatus?.() ?? res?.statusCode ?? 500;

    const record: Record<string, unknown> = {
      user: req.user?.sub ?? req.user?.id ?? 'anonymous',
      ip: req.ip ?? req.headers?.['x-forwarded-for'] ?? req.connection?.remoteAddress ?? null,
      method: req.method,
      url: req.originalUrl ?? req.url,
      route: req.route?.path ?? null,
      params: req.params && Object.keys(req.params).length ? req.params : undefined,
      status,
      duration_ms: durationMs,
      user_agent: req.headers?.['user-agent'] ?? null,
      request_id: req.requestId ?? req.headers?.['x-request-id'] ?? null,
    };

    // Body: only for write methods, redact sensitive fields
    if (['POST', 'PUT', 'PATCH'].includes(req.method) && req.body && typeof req.body === 'object') {
      record.body = redact(req.body);
    }

    // Query params
    if (req.query && Object.keys(req.query).length) {
      record.query = req.query;
    }

    // Error details
    if (err) {
      record.error = err.message ?? String(err);
      if (status >= 500 && err.stack) {
        record.stack = err.stack;
      }
    }

    // Log level based on status
    if (status >= 500) {
      this.logger.error(JSON.stringify(record));
    } else if (status >= 400) {
      this.logger.warn(JSON.stringify(record));
    } else {
      this.logger.log(JSON.stringify(record));
    }
  }
}

const SENSITIVE_KEYS = [
  'password', 'newpassword', 'currentpassword', 'old_password',
  'confirmpassword', 'token', 'refreshtoken', 'accesstoken',
  'secret', 'apikey', 'pem', 'authorization', 'cookie',
  'otp', 'googleid', 'creditcard', 'ssn',
];

function redact<T extends Record<string, any>>(obj: T): Record<string, any> {
  const out: any = Array.isArray(obj) ? [] : {};
  for (const [k, v] of Object.entries(obj)) {
    if (SENSITIVE_KEYS.some((s) => k.toLowerCase().includes(s))) {
      out[k] = '[REDACTED]';
    } else if (v && typeof v === 'object' && !(v instanceof Date)) {
      out[k] = redact(v);
    } else {
      out[k] = v;
    }
  }
  return out;
}
