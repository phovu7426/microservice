import {
  ArgumentMetadata,
  BadRequestException,
  Injectable,
  PipeTransform,
} from '@nestjs/common';
import { I18nContext } from 'nestjs-i18n';
import { commonMsg } from '../i18n/common-messages';

const NUMERIC_RE = /^\d{1,20}$/;

/**
 * Parse a route param / query as a positive bigint. Returns 400 on invalid
 * input instead of letting `BigInt('abc')` throw a raw `SyntaxError` that
 * surfaces as a 500 to the client.
 */
@Injectable()
export class ParseBigIntPipe implements PipeTransform<string, bigint> {
  transform(value: string, metadata: ArgumentMetadata): bigint {
    const lang = I18nContext.current()?.lang ?? 'vi';
    const field = metadata.data ?? 'param';
    if (typeof value !== 'string' || !NUMERIC_RE.test(value)) {
      throw new BadRequestException(commonMsg(lang, 'PARAM_MUST_BE_POSITIVE_INT', { field }));
    }
    try {
      const result = BigInt(value);
      if (result <= BigInt(0)) {
        throw new BadRequestException(commonMsg(lang, 'PARAM_MUST_BE_GT_ZERO', { field }));
      }
      return result;
    } catch {
      throw new BadRequestException(commonMsg(lang, 'PARAM_MUST_BE_POSITIVE_INT', { field }));
    }
  }
}
