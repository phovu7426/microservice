import {
  HttpException,
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { ResponseUtil } from './response.util';
import { mapExceptionToResponse } from './exception-mapper.helper';

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, any> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      map((raw) => this.handleSuccess(raw)),
      catchError((err) => this.handleError(err)),
    );
  }

  private handleSuccess(raw: any): any {
    if (isApiResponse(raw)) return raw;

    if (
      raw &&
      typeof raw === 'object' &&
      'data' in raw &&
      'meta' in raw
    ) {
      const { data, meta } = raw;
      return ResponseUtil.paginated(
        data,
        meta.page || meta.currentPage || 1,
        meta.limit || meta.itemsPerPage || 10,
        meta.total ?? meta.totalItems ?? 0,
      );
    }

    return ResponseUtil.success(raw);
  }

  private handleError(err: any): Observable<never> {
    if (isApiResponse(err?.response)) {
      return throwError(() => err);
    }

    const { message, code, status, errors } = mapExceptionToResponse(err);
    const apiError = ResponseUtil.error(message, code, status, errors);
    const httpStatus = apiError.httpStatus ?? status;

    return throwError(() => new HttpException(apiError, httpStatus));
  }
}

function isApiResponse(obj: any): boolean {
  return (
    obj && typeof obj === 'object' && 'success' in obj && 'timestamp' in obj
  );
}
