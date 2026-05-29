import { Injectable, ForbiddenException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { I18nService } from 'nestjs-i18n';
import { t } from '@package/common';
import { FileLogger } from '@package/bootstrap';
import { RedisService } from '@package/redis';
import { AttemptLimiterService } from '../../../core/security/services/attempt-limiter.service';
import { UserRepository } from '../repositories/user.repository';
import { generateOtp, buildOtpKey } from '../utils/otp.helper';

@Injectable()
export class AuthOtpService {
  private readonly otpTtlSec: number;

  constructor(
    private readonly redis: RedisService,
    private readonly userRepo: UserRepository,
    private readonly config: ConfigService,
    private readonly attemptLimiter: AttemptLimiterService,
    private readonly i18n: I18nService,
    private readonly fileLogger: FileLogger,
  ) {
    this.otpTtlSec = Number(this.config.get('OTP_TTL_SECONDS') ?? 300);
  }

  async sendRegisterOtp(email: string): Promise<void> {
    await this.sendOtp('register', email, 'send_otp_register');
  }

  async sendForgotPasswordOtp(email: string): Promise<void> {
    await this.sendOtp('forgot-password', email, 'send_otp_forgot_password');
  }

  async verifyAndDelete(type: string, email: string, providedOtp: string): Promise<boolean> {
    const scope = `otp:verify:${type}`;
    const lockout = await this.attemptLimiter.check(scope, email);
    if (lockout.isLocked) {
      throw new ForbiddenException(
        t(this.i18n, 'auth.OTP_VERIFY_LOCKED', { minutes: lockout.remainingMinutes }),
      );
    }
    const key = buildOtpKey(type, email);
    const cached = await this.redis.get(key);
    if (!cached || !safeEqual(cached, providedOtp)) {
      await this.attemptLimiter.add(scope, email, {
        maxAttempts: 5,
        lockoutSeconds: 900,
        windowSeconds: 300,
      });
      return false;
    }

    // OTP matched — delete immediately to prevent reuse
    await this.redis.del(key);
    await this.attemptLimiter.reset(scope, email);
    return true;
  }

  private async sendOtp(type: string, email: string, templateCode: string): Promise<void> {
    const log = this.fileLogger.create(`auth/otp-${type}`, { email, templateCode });
    const key = buildOtpKey(type, email);

    // Check if an OTP is still alive — prevent spam resend
    log.addDebug('checking existing OTP');
    const existing = await this.redis.get(key);
    if (existing) {
      const ttl = await this.redis.ttl(key);
      const remaining = ttl > 0 ? ttl : this.otpTtlSec;
      log.addException(new Error('otp_still_valid'));
      log.save();
      throw new BadRequestException(
        t(this.i18n, 'auth.OTP_STILL_VALID', { seconds: remaining }),
      );
    }

    log.addDebug('generating OTP');
    const otp = generateOtp();

    log.addDebug('enqueuing mail event');
    try {
      await this.userRepo.enqueueOutboxEvent('mail.send', {
        to: email,
        templateCode,
        variables: { otp },
      });
    } catch (err: any) {
      await this.redis.del(key).catch(() => undefined);
      log.addException(err);
      log.save();
      throw err;
    }

    log.addDebug('storing OTP in Redis');
    await this.redis.set(key, otp, this.otpTtlSec);
    log.save();
  }
}

function safeEqual(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}
