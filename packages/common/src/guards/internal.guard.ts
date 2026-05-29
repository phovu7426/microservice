import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'crypto';
import { I18nContext } from 'nestjs-i18n';
import { commonMsg } from '../i18n/common-messages';

@Injectable()
export class InternalGuard implements CanActivate {
  private readonly logger = new Logger(InternalGuard.name);

  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const lang = I18nContext.current()?.lang ?? 'vi';
    const request = context.switchToHttp().getRequest();
    const secret = request.headers['x-internal-secret'];
    const expected =
      this.config.get<string>('INTERNAL_API_SECRET') ||
      this.config.get<string>('app.internalApiSecret');

    // Fail-closed: if no secret is configured, reject all internal requests.
    // This prevents accidentally exposing internal endpoints when the env var
    // is missing.
    if (!expected) {
      this.logger.error('INTERNAL_API_SECRET not configured — rejecting internal request');
      throw new UnauthorizedException(commonMsg(lang, 'INTERNAL_SECRET_NOT_CONFIGURED'));
    }

    if (!secret || typeof secret !== 'string' || secret.length !== expected.length ||
        !timingSafeEqual(Buffer.from(secret), Buffer.from(expected))) {
      throw new UnauthorizedException(commonMsg(lang, 'INVALID_INTERNAL_SECRET'));
    }
    return true;
  }
}
