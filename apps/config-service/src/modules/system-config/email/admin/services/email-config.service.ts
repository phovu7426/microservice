import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { I18nContext, I18nService } from 'nestjs-i18n';
import { EmailConfigRepository } from '../../repositories/email-config.repository';
import { UpdateEmailConfigDto } from '../dtos/update-email-config.dto';
import { buildConfigPayload } from '../../../helpers/config-payload.helper';

const MASKED = '******';

@Injectable()
export class EmailConfigService {
  constructor(
    private readonly emailConfigRepo: EmailConfigRepository,
    private readonly i18n: I18nService,
  ) {}

  private t(key: string): string {
    const lang = I18nContext.current()?.lang ?? 'en';
    return this.i18n.t(key, { lang }) as string;
  }

  /** Admin-facing read — masks SMTP password before returning. */
  async getConfig(): Promise<any> {
    const config = await this.emailConfigRepo.getConfig();
    return this.maskPassword(config);
  }

  /**
   * Internal-facing read for cross-service mailers.
   *
   * NOTE: This path returns plaintext SMTP credentials. It is gated by the
   * `@Internal()` decorator + `INTERNAL_API_SECRET` shared secret in the
   * controller. If you broaden the audience, switch to a per-consumer token
   * or KMS-decrypt-on-demand pattern.
   */
  async getRawConfig(): Promise<any> {
    return this.emailConfigRepo.getConfig();
  }

  async updateConfig(dto: UpdateEmailConfigDto, userId?: any): Promise<any> {
    const existing = await this.emailConfigRepo.getConfig();

    // If the client echoes back the masked placeholder, treat it as
    // "unchanged" — never persist `'******'` as the real password.
    if (dto.smtpPassword === MASKED || (existing && !dto.smtpPassword)) {
      delete (dto as any).smtpPassword;
    }

    const payload = buildConfigPayload(dto, [], userId, existing);

    if (!existing) {
      // First-write must include all required fields.
      const required = ['smtpHost', 'smtpUsername', 'smtpPassword', 'fromEmail', 'fromName'];
      for (const field of required) {
        if (!payload[field]) {
          throw new BadRequestException(this.t(`system-config.EMAIL_${field.toUpperCase()}_REQUIRED`));
        }
      }
    }

    // Map camelCase payload → snake_case Prisma fields
    const dbPayload = {
      smtp_host: payload.smtpHost,
      smtp_port: payload.smtpPort ?? 587,
      smtp_secure: payload.smtpSecure ?? true,
      smtp_username: payload.smtpUsername,
      smtp_password: payload.smtpPassword,
      from_email: payload.fromEmail,
      from_name: payload.fromName,
      reply_to_email: payload.replyToEmail,
      created_user_id: payload.created_user_id,
      updated_user_id: payload.updated_user_id,
    };

    const result = await this.emailConfigRepo.upsert(dbPayload, dbPayload);

    if (!result) {
      throw new InternalServerErrorException(this.t('system-config.EMAIL_UPDATE_FAILED'));
    }

    return this.maskPassword(result);
  }

  private maskPassword(config: any): any {
    if (!config) return config;
    const item = { ...config };
    if (item.smtp_password) item.smtp_password = MASKED;
    return item;
  }
}
