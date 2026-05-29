import {
  HttpStatus,
  HttpException,
  BadRequestException,
  UnauthorizedException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';

export function mapExceptionToResponse(exception: any): {
  message: string;
  code: string;
  status: number;
  errors?: any;
} {
  const status =
    exception instanceof HttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

  const exceptionResponse: any =
    exception instanceof HttpException ? exception.getResponse() : null;

  let message = exception.message || 'Internal server error';
  let code = 'ERROR';
  let errors: any = null;

  if (exception instanceof BadRequestException) code = 'BAD_REQUEST';
  else if (exception instanceof UnauthorizedException) code = 'UNAUTHORIZED';
  else if (exception instanceof ForbiddenException) code = 'FORBIDDEN';
  else if (exception instanceof NotFoundException) code = 'NOT_FOUND';

  if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
    message = exceptionResponse.message || message;
    errors = exceptionResponse.errors || exceptionResponse.error || null;

    if (Array.isArray(exceptionResponse.message)) {
      message = exceptionResponse.message[0] || 'Validation failed';
      errors = exceptionResponse.message;
      code = 'VALIDATION_ERROR';
    }
  }

  return { message, code, status, errors };
}
