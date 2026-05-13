import { ConflictException, ForbiddenException, Injectable } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { I18nService } from 'nestjs-i18n';
import { t } from '@package/common';
import { FileLogger } from '@package/bootstrap';
import { Prisma } from 'src/generated/prisma';
import { UserRepository } from '../repositories/user.repository';
import { TokenService } from './token.service';
import { safeUser } from '../utils/user.util';
import { PrimaryKey } from 'src/types';
import { UserStatus } from '../../user/enums/user-status.enum';

@Injectable()
export class SocialAuthService {
  constructor(
    private readonly userRepo: UserRepository,
    private readonly tokenService: TokenService,
    private readonly i18n: I18nService,
    private readonly fileLogger: FileLogger,
  ) {}

  async handleGoogleAuth(profile: {
    googleId: string;
    email: string;
    firstName?: string;
    lastName?: string;
    picture?: string;
  }) {
    const email = profile.email.toLowerCase();
    const now = new Date();
    const log = this.fileLogger.create('auth/google-oauth', { email, googleId: profile.googleId });

    log.addDebug('finding existing user');
    const existing = await this.userRepo.findByEmail(email);

    if (existing && existing.googleId && existing.googleId !== profile.googleId) {
      log.addException(new Error('account_linked_to_other'));
      log.save();
      throw new ForbiddenException(t(this.i18n, 'auth.ACCOUNT_LINKED_TO_OTHER'));
    }

    if (existing && existing.status !== UserStatus.active) {
      log.addException(new Error('account_locked'));
      log.save();
      throw new ForbiddenException(t(this.i18n, 'auth.ACCOUNT_LOCKED'));
    }

    const fullName = this.resolveFullName(profile);
    let dbUser;

    if (existing) {
      log.addDebug('updating existing user');
      dbUser = await this.userRepo.update(existing.id, {
        name: fullName,
        image: profile.picture ?? null,
        googleId: profile.googleId,
        emailVerifiedAt: existing.emailVerifiedAt ?? now,
        lastLoginAt: now,
      });
    } else {
      log.addDebug('creating new user');
      dbUser = await this.createWithUniqueUsername(email, profile.googleId, fullName, profile.picture, now);
    }

    log.addDebug('generating tokens');
    const userId: PrimaryKey = dbUser.id;
    const tokens = await this.tokenService.generateTokens(userId, dbUser.email!);
    await this.tokenService.storeRefreshJti(userId, tokens.refreshJti, tokens.refreshTtlSec);

    log.save({ userId: String(dbUser.id), isNew: !existing });
    return {
      token: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: tokens.accessTtlSec,
      user: safeUser(dbUser),
    };
  }

  private resolveFullName(profile: {
    firstName?: string;
    lastName?: string;
    email?: string;
  }): string {
    return (
      [profile.firstName, profile.lastName].filter(Boolean).join(' ') ||
      (profile.email ? profile.email.split('@')[0] : '') ||
      'User'
    );
  }

  private async createWithUniqueUsername(
    email: string,
    googleId: string,
    name: string,
    picture: string | undefined,
    now: Date,
  ) {
    const base = email.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '').slice(0, 40) || 'user';
    for (let i = 0; i < 6; i++) {
      const suffix = i < 5 ? randomBytes(3).toString('hex') : randomBytes(8).toString('hex');
      const candidate = `${base}_${suffix}`;
      try {
        return await this.userRepo.withTransaction(async (tx) => {
          const created = await this.userRepo.create(
            {
              email,
              username: candidate,
              name,
              image: picture ?? null,
              googleId,
              status: UserStatus.active,
              emailVerifiedAt: now,
              lastLoginAt: now,
            },
            tx,
          );
          await this.userRepo.enqueueOutboxEvent(
            'user.registered',
            {
              user_id: String(created.id),
              email: created.email,
              username: created.username,
              name: created.name,
              source: 'google',
              occurred_at: new Date().toISOString(),
            },
            tx,
          );
          return created;
        });
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
          continue;
        }
        throw err;
      }
    }
    throw new ConflictException(t(this.i18n, 'auth.USERNAME_GENERATION_FAILED'));
  }
}
