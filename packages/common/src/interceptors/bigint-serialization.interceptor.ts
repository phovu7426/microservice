import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable, map } from 'rxjs';

/**
 * Converts snake_case key to camelCase.
 * Example: "created_at" → "createdAt", "site_name" → "siteName"
 * Keys already in camelCase are returned as-is (no underscore → no change).
 */
function toCamelCase(key: string): string {
  return key.replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase());
}

/**
 * Single-pass response serializer:
 * 1. Converts BigInt values → strings (preserves precision for large IDs)
 * 2. Converts object keys from snake_case → camelCase
 *
 * Returns the original object untouched when no transformations are needed.
 */
function serializeResponse(data: any): any {
  if (data === null || data === undefined) return data;
  if (typeof data === 'bigint') return String(data);
  if (data instanceof Date) return data;
  if (Array.isArray(data)) {
    return data.map(item => serializeResponse(item));
  }
  if (typeof data === 'object') {
    const obj: any = {};
    for (const key of Object.keys(data)) {
      obj[toCamelCase(key)] = serializeResponse(data[key]);
    }
    return obj;
  }
  return data;
}

@Injectable()
export class BigIntSerializationInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      map((data) => serializeResponse(data)),
    );
  }
}
