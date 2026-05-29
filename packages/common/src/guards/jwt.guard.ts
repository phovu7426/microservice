import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import * as jose from 'jose';
import { timingSafeEqual } from 'crypto';
import { I18nContext } from 'nestjs-i18n';
import { commonMsg } from '../i18n/common-messages';

const PERMS_KEY = 'perms_required';

@Injectable()
export class JwtGuard implements CanActivate {
  private jwks: jose.JWTVerifyGetKey | null = null;
  private lastFetch = 0;
  private readonly TTL_MS = 5 * 60 * 1000; // 5 minutes — matches Nginx JWKS cache

  constructor(
    private readonly reflector: Reflector,
    private readonly config: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Skip HTTP-specific auth for non-HTTP contexts (RabbitMQ, gRPC, WebSocket).
    // Message handlers define their own auth at the handler level.
    if (context.getType() !== 'http') return true;

    const permissions = this.reflector.getAllAndOverride<string[]>(PERMS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]) ?? [];

    if (!permissions.length) return false;

    const lang = I18nContext.current()?.lang ?? 'vi';

    if (permissions.includes('public')) {
      await this.trySetUser(context);
      return true;
    }

    // Internal routes bypass JWT
    if (permissions.includes('internal')) {
      return this.checkInternal(context, lang);
    }

    const token = this.extractToken(context);
    if (!token) throw new UnauthorizedException(commonMsg(lang, 'TOKEN_REQUIRED'));

    const jwksUrl = this.config.get<string>('AUTH_JWKS_URL');

    // Refuse to authenticate without a JWKS endpoint. In dev, set
    // AUTH_JWKS_URL=http://localhost:3002/.well-known/jwks.json and let the
    // local auth-service issue tokens — never hand out an arbitrary `dev`
    // identity, which gives any caller (including unauthenticated ones) the
    // ability to bypass admin checks downstream.
    if (!jwksUrl) {
      throw new UnauthorizedException(commonMsg(lang, 'AUTH_NOT_CONFIGURED'));
    }

    let payload: jose.JWTPayload;
    try {
      payload = await this.verifyToken(token, jwksUrl);
    } catch {
      throw new UnauthorizedException(commonMsg(lang, 'INVALID_OR_EXPIRED_TOKEN'));
    }

    // Refresh tokens are signed with the same keypair as access tokens but
    // carry { type: 'refresh' }. They must never authorize a regular request.
    if ((payload as any)?.type === 'refresh') {
      throw new UnauthorizedException(commonMsg(lang, 'INVALID_TOKEN_TYPE'));
    }

    const request = context.switchToHttp().getRequest();
    request.user = payload;
    return true;
  }

  private async trySetUser(context: ExecutionContext): Promise<void> {
    const token = this.extractToken(context);
    if (!token) return;
    const jwksUrl = this.config.get<string>('AUTH_JWKS_URL');
    if (!jwksUrl) return;
    try {
      const payload = await this.verifyToken(token, jwksUrl);
      if ((payload as any)?.type === 'refresh') return;
      context.switchToHttp().getRequest().user = payload;
    } catch {
      // optional auth on public route — ignore errors
    }
  }

  private checkInternal(context: ExecutionContext, lang: string): boolean {
    const request = context.switchToHttp().getRequest();
    const secret = request.headers['x-internal-secret'] as string | undefined;
    const expected = this.config.get<string>('INTERNAL_API_SECRET') || this.config.get<string>('app.internalApiSecret');
    if (!expected) {
      throw new UnauthorizedException(commonMsg(lang, 'INTERNAL_SECRET_NOT_CONFIGURED'));
    }
    if (!secret || secret.length !== expected.length ||
        !timingSafeEqual(Buffer.from(secret), Buffer.from(expected))) {
      throw new UnauthorizedException(commonMsg(lang, 'INVALID_INTERNAL_SECRET'));
    }
    return true;
  }

  private async verifyToken(token: string, jwksUrl: string): Promise<jose.JWTPayload> {
    if (!this.jwks || Date.now() - this.lastFetch > this.TTL_MS) {
      this.jwks = jose.createRemoteJWKSet(new URL(jwksUrl));
      this.lastFetch = Date.now();
    }
    // Verify issuer and audience explicitly. Without these, any RS256 token
    // signed by a key the JWKS endpoint serves would be accepted — including
    // tokens issued for a different product / tenant that happens to share
    // the JWKS URL.
    const issuer = this.config.get<string>('JWT_ISSUER') || 'auth-service';
    const audience = this.config.get<string>('JWT_AUDIENCE') || 'comic-platform';
    const { payload } = await jose.jwtVerify(token, this.jwks, {
      algorithms: ['RS256'],
      issuer,
      audience,
    });
    return payload;
  }

  private extractToken(context: ExecutionContext): string | null {
    const request = context.switchToHttp().getRequest();
    const auth = request.headers?.authorization as string | undefined;
    if (auth?.startsWith('Bearer ')) return auth.slice(7);
    // Also accept HttpOnly cookie set by auth-service (browser clients)
    const cookie = request.cookies?.auth_token as string | undefined;
    return cookie ?? null;
  }
}
