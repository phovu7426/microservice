import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, tap, catchError, throwError } from 'rxjs';
import { AUDIT_LOG_KEY, AuditLogMeta } from './audit-log.decorator';

/**
 * Emits a single JSON-friendly log entry per @AuditLog-decorated handler.
 *
 * The line goes through the regular Nest logger (so JsonLogger picks it up
 * in production and ships JSON to stdout). To filter audit-only logs out of
 * the rest of the noise, downstream pipelines can match on `audit:1` in the
 * `ctx` field.
 *
 * What we capture:
 *   - actor:     req.userId (set by AuthJwtGuard) — falls back to 'anonymous'
 *   - action:    decorator's `action` (e.g. 'user.delete')
 *   - resource:  decorator's `resource` + the URL `:id` param if present
 *   - method, route, status (200 = ok, 4xx/5xx populated by catchError)
 *   - ip:        from req (already real-ip-resolved by Nginx)
 *   - request_id: from middleware
 *   - body:      only if meta.includeBody === true
 *
 * Best-effort: never block the request on audit failure.
 */
@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  private readonly logger = new Logger('Audit');

  constructor(private readonly reflector: Reflector) {}

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const meta = this.reflector.get<AuditLogMeta>(AUDIT_LOG_KEY, ctx.getHandler());
    if (!meta) return next.handle();

    const req: any = ctx.switchToHttp().getRequest();
    const startedAt = Date.now();
    const base = this.captureBase(req, meta);

    return next.handle().pipe(
      tap((response) => {
        this.emit({
          ...base,
          status: 'ok',
          duration_ms: Date.now() - startedAt,
          response_id: this.extractId(response),
        });
      }),
      catchError((err) => {
        this.emit({
          ...base,
          status: 'error',
          duration_ms: Date.now() - startedAt,
          error_code: err?.status ?? 500,
          error_message: err?.message ?? String(err),
        });
        return throwError(() => err);
      }),
    );
  }

  private captureBase(req: any, meta: AuditLogMeta) {
    const result: Record<string, unknown> = {
      'audit': 1,
      action: meta.action,
      resource: meta.resource ?? null,
      target_id: req.params?.id ?? null,
      method: req.method,
      route: req.route?.path ?? req.originalUrl ?? req.url ?? '',
      ip: req.ip ?? req.headers?.['x-forwarded-for'] ?? null,
      user_agent: req.headers?.['user-agent'] ?? null,
      // JwtGuard sets req.user = JWT payload; the user id lives in `sub`.
      // Keep the legacy fallbacks for any handler that injects them manually.
      actor: req.user?.sub ?? req.userId ?? req.user?.id ?? 'anonymous',
      request_id: req.requestId ?? req.headers?.['x-request-id'] ?? null,
    };
    if (meta.includeBody && req.body && typeof req.body === 'object') {
      result.body = redact(req.body);
    }
    return result;
  }

  private extractId(response: unknown): string | null {
    if (response && typeof response === 'object') {
      const r = response as Record<string, any>;
      if (r.id !== undefined) return String(r.id);
      if (r.data?.id !== undefined) return String(r.data.id);
    }
    return null;
  }

  private emit(record: Record<string, unknown>) {
    try {
      this.logger.log(JSON.stringify(record));
    } catch {
      // never let audit logging itself break the request
    }
  }
}

/**
 * Strip obvious sensitive fields before logging the request body.
 * Not exhaustive — only enable `includeBody` on safe handlers.
 */
function redact<T extends Record<string, any>>(obj: T): T {
  const SENSITIVE = ['password', 'newPassword', 'currentPassword', 'token',
    'refreshToken', 'accessToken', 'secret', 'apiKey', 'pem',
    'authorization', 'cookie', 'email', 'phone', 'ssn', 'creditCard',
    'otp', 'googleId'];
  const out: any = Array.isArray(obj) ? [] : {};
  for (const [k, v] of Object.entries(obj)) {
    if (SENSITIVE.some((s) => k.toLowerCase().includes(s.toLowerCase()))) {
      out[k] = '[REDACTED]';
    } else if (v && typeof v === 'object') {
      out[k] = redact(v);
    } else {
      out[k] = v;
    }
  }
  return out;
}
