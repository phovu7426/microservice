import { HttpStatus } from '@nestjs/common';
import { formatResponseTimestamp } from './response-timestamp.helper';

export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  code: string;
  httpStatus: number;
  data: T | null;
  meta: object;
  timestamp: string;
}

export interface PaginationMeta {
  currentPage: number;
  itemCount: number;
  itemsPerPage: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export class ResponseUtil {
  static success<T>(
    data?: T,
    message = 'Success',
    code = 'SUCCESS',
    httpStatus = HttpStatus.OK,
    meta?: object,
  ): ApiResponse<T> {
    return {
      success: true,
      message,
      code,
      httpStatus,
      data: data ?? null,
      meta: meta ?? {},
      timestamp: formatResponseTimestamp(),
    };
  }

  static error(
    message = 'Error',
    code = 'ERROR',
    httpStatus = HttpStatus.BAD_REQUEST,
    errors?: any,
  ): ApiResponse<null> {
    return {
      success: false,
      message,
      code,
      httpStatus,
      data: null,
      meta: errors ?? {},
      timestamp: formatResponseTimestamp(),
    };
  }

  static paginated<T>(
    data: T[],
    currentPage: number,
    itemsPerPage: number,
    totalItems: number,
    message = 'Success',
    code = 'SUCCESS',
  ): ApiResponse<T[]> {
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    const meta: PaginationMeta = {
      currentPage,
      itemCount: data.length,
      itemsPerPage,
      totalItems,
      totalPages,
      hasNextPage: currentPage < totalPages,
      hasPreviousPage: currentPage > 1,
    };
    return this.success(data, message, code, HttpStatus.OK, meta);
  }

  static created<T>(data?: T, message = 'Created'): ApiResponse<T> {
    return this.success(data, message, 'CREATED', HttpStatus.CREATED);
  }

  static updated<T>(data?: T, message = 'Updated'): ApiResponse<T> {
    return this.success(data, message, 'UPDATED', HttpStatus.OK);
  }

  static deleted(message = 'Deleted'): ApiResponse<null> {
    return this.success(null, message, 'DELETED', HttpStatus.OK);
  }

  static notFound(message = 'Not found'): ApiResponse<null> {
    return this.error(message, 'NOT_FOUND', HttpStatus.NOT_FOUND);
  }

  static validationError(errors: any, message = 'Validation failed'): ApiResponse<null> {
    return this.error(message, 'VALIDATION_ERROR', HttpStatus.BAD_REQUEST, errors);
  }

  static forbidden(message = 'Forbidden'): ApiResponse<null> {
    return this.error(message, 'FORBIDDEN', HttpStatus.FORBIDDEN);
  }

  static unauthorized(message = 'Unauthorized'): ApiResponse<null> {
    return this.error(message, 'UNAUTHORIZED', HttpStatus.UNAUTHORIZED);
  }

  static badRequest(message = 'Bad request', errors?: any): ApiResponse<null> {
    return this.error(message, 'BAD_REQUEST', HttpStatus.BAD_REQUEST, errors);
  }

  static conflict(message = 'Conflict'): ApiResponse<null> {
    return this.error(message, 'CONFLICT', HttpStatus.CONFLICT);
  }

  static tooManyRequests(message = 'Too many requests'): ApiResponse<null> {
    return this.error(message, 'TOO_MANY_REQUESTS', HttpStatus.TOO_MANY_REQUESTS);
  }
}
