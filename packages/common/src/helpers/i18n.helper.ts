import { I18nContext, I18nService } from 'nestjs-i18n';

/**
 * Translate a key using the current request's language (falls back to 'en').
 *
 * Usage — inject `I18nService` once, then call the free function:
 * ```ts
 * import { t } from '@package/common';
 * throw new BadRequestException(t(this.i18n, 'auth.INVALID_OTP'));
 * ```
 */
export function t(
  i18n: I18nService,
  key: string,
  args?: Record<string, unknown>,
): string {
  const lang = I18nContext.current()?.lang ?? 'vi';
  return i18n.t(key, { lang, args }) as string;
}
