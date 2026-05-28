import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import * as jose from 'jose';
import { authMsg } from './i18n/auth-messages';

export const PERMS_KEY = 'perms_required';
export const PUBLIC = 'public';
export const USER = 'user';

/**
 * JwtLocalGuard — dùng cho microservices (Storage, Gateway, v.v.)
 * Verify JWT bằng JWKS public key từ Auth Service.
 * Khi AUTH_JWKS_URL không được set (local dev), guard bypass authentication.
 */
@Injectable()
export class JwtLocalGuard implements CanActivate {
  private jwks: jose.JWTVerifyGetKey | null = null;
  private lastFetch = 0;
  private readonly TTL_MS = 5 * 60 * 1000; // 5 minutes — matches Nginx JWKS cache

  constructor(
    private readonly reflector: Reflector,
    private readonly config: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const permissions = this.reflector.getAllAndOverride<string[]>(PERMS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]) ?? [];

    // No decorator → deny
    if (!permissions.length) return false;

    // Public route → allow always
    if (permissions.includes(PUBLIC)) {
      await this.trySetUser(context);
      return true;
    }

    const lang = this.getLang(context);

    // User/protected route → verify JWT
    const token = this.extractToken(context);
    if (!token) throw new UnauthorizedException(authMsg(lang, 'TOKEN_REQUIRED'));

    const jwksUrl = this.config.get<string>('AUTH_JWKS_URL');

    // Fail-closed: refuse to authenticate without a JWKS endpoint.
    // Previously this handed out a hardcoded { sub: 'dev' } identity which
    // allowed any caller to bypass auth if the env var was accidentally unset.
    if (!jwksUrl) {
      throw new UnauthorizedException(authMsg(lang, 'AUTH_NOT_CONFIGURED'));
    }

    const payload = await this.verifyToken(token, jwksUrl);

    // Refresh tokens are signed with the same keypair as access tokens but
    // carry { type: 'refresh' }. They must never authorize a regular request.
    if ((payload as any)?.type === 'refresh') {
      throw new UnauthorizedException(authMsg(lang, 'INVALID_TOKEN_TYPE'));
    }

    const request = context.switchToHttp().getRequest();
    request.user = payload;
    return true;
  }

  private getLang(context: ExecutionContext): string {
    try {
      const req = context.switchToHttp().getRequest();
      const accept = ((req?.headers?.['accept-language'] ?? '') as string).toLowerCase();
      return accept.startsWith('en') ? 'en' : 'vi';
    } catch {
      return 'vi';
    }
  }

  private async trySetUser(context: ExecutionContext): Promise<void> {
    const token = this.extractToken(context);
    if (!token) return;
    const jwksUrl = this.config.get<string>('AUTH_JWKS_URL');
    if (!jwksUrl) return;
    try {
      const payload = await this.verifyToken(token, jwksUrl);
      if ((payload as any)?.type === 'refresh') return;
      const request = context.switchToHttp().getRequest();
      request.user = payload;
    } catch {
      // optional auth on public route — ignore errors
    }
  }

  private async verifyToken(
    token: string,
    jwksUrl: string,
  ): Promise<jose.JWTPayload> {
    if (!this.jwks || Date.now() - this.lastFetch > this.TTL_MS) {
      this.jwks = jose.createRemoteJWKSet(new URL(jwksUrl));
      this.lastFetch = Date.now();
    }
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
    if (!auth?.startsWith('Bearer ')) return null;
    return auth.slice(7);
  }
}
