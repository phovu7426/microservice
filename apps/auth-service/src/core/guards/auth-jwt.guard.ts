import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { I18nService } from 'nestjs-i18n';
import { t } from '@package/common';
import { JwksService } from '../../jwks/services/jwks.service';
import { TokenBlacklistService } from '../security/services/token-blacklist.service';
import { IamClient } from '../../clients/iam.client';

const PERMS_KEY = 'perms_required';
const AUTH_ONLY_PERMS = new Set(['user']);

@Injectable()
export class AuthJwtGuard implements CanActivate {
  private readonly isProd: boolean;

  constructor(
    private readonly reflector: Reflector,
    private readonly config: ConfigService,
    private readonly jwksService: JwksService,
    private readonly i18n: I18nService,
    private readonly tokenBlacklistService: TokenBlacklistService,
    private readonly iamClient: IamClient,
  ) {
    this.isProd = (config.get<string>('app.nodeEnv') ?? process.env.NODE_ENV) === 'production';
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const permissions = this.reflector.getAllAndOverride<string[]>(PERMS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]) ?? [];

    if (!permissions.length) return false;

    if (permissions.includes('public')) {
      await this.trySetUser(context);
      return true;
    }

    if (permissions.includes('internal')) {
      return true;
    }

    const request = context.switchToHttp().getRequest();

    // Reuse verified JWT from trySetUser() to avoid double verification
    if (request._jwtVerified && request.user) {
      // JWT already verified and blacklist checked — skip to RBAC
    } else {
      // JWT verification
      const token = this.extractToken(request);
      if (!token) throw new UnauthorizedException(t(this.i18n, 'auth.TOKEN_REQUIRED'));

      let payload: any;
      try {
        payload = await this.jwksService.verifyToken(token);
      } catch {
        throw new UnauthorizedException(t(this.i18n, 'auth.INVALID_TOKEN'));
      }

      if (payload?.type === 'refresh') {
        throw new UnauthorizedException(t(this.i18n, 'auth.INVALID_TOKEN'));
      }

      if (await this.tokenBlacklistService.has(token)) {
        throw new UnauthorizedException(t(this.i18n, 'auth.INVALID_TOKEN'));
      }

      request.user = payload;
      request._jwtVerified = true;
    }

    // Auth-only permissions (e.g. 'user') — skip IAM
    if (permissions.every((p) => AUTH_ONLY_PERMS.has(p))) {
      return true;
    }

    // RBAC check via IAM
    if (!this.iamClient.isConfigured()) {
      if (this.isProd) throw new ForbiddenException(t(this.i18n, 'auth.PERMISSION_DENIED'));
      return true;
    }

    const groupId = (request.headers['x-group-id'] as string) || undefined;
    try {
      const allowed = await this.iamClient.checkPermissions(String(request.user.sub), permissions, groupId);
      if (!allowed) throw new ForbiddenException(t(this.i18n, 'auth.PERMISSION_DENIED'));
    } catch (err) {
      if (err instanceof ForbiddenException) throw err;
      throw new ForbiddenException(t(this.i18n, 'auth.PERMISSION_DENIED'));
    }

    return true;
  }

  private async trySetUser(context: ExecutionContext): Promise<void> {
    const request = context.switchToHttp().getRequest();
    if (request._jwtVerified && request.user) return;
    const token = this.extractToken(request);
    if (!token) return;
    try {
      const payload = await this.jwksService.verifyToken(token);
      if ((payload as any)?.type === 'refresh') return;
      if (await this.tokenBlacklistService.has(token)) return;
      request.user = payload;
      request._jwtVerified = true;
    } catch { /* optional auth — ignore */ }
  }

  private extractToken(request: any): string | null {
    const auth = request.headers?.authorization as string | undefined;
    if (!auth?.startsWith('Bearer ')) return null;
    return auth.slice(7);
  }
}
