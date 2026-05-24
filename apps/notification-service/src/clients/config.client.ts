import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FileLogger } from '@package/bootstrap';
import { createCircuitBreaker } from '@package/circuit-breaker';

export interface EmailConfig {
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUsername: string;
  smtpPassword: string;
  fromEmail: string;
  fromName?: string;
  replyToEmail?: string;
}

@Injectable()
export class ConfigClient {
  private readonly breaker = createCircuitBreaker({
    halfOpenAfterMs: 10_000,
    maxConsecutiveFailures: 5,
  });

  constructor(
    private readonly config: ConfigService,
    private readonly fileLogger: FileLogger,
  ) {
    this.breaker.onBreak(() => {
      const log = this.fileLogger.create('config-client/circuit-break', {});
      log.addDebug('circuit_opened');
      log.save();
    });
  }

  async getEmailConfig(): Promise<EmailConfig | null> {
    const configUrl = this.config.get<string>('CONFIG_INTERNAL_URL');
    if (!configUrl) {
      const log = this.fileLogger.create('config-client/get-email-config', {});
      log.addDebug('config_url_missing');
      log.save();
      return null;
    }

    try {
      return await this.breaker.execute(async () => {
        const secret =
          this.config.get<string>('INTERNAL_API_SECRET') ||
          this.config.get<string>('INTERNAL_SECRET');

        const ac = new AbortController();
        const timer = setTimeout(() => ac.abort(), 5_000);
        try {
          const res = await fetch(`${configUrl}/email`, {
            headers: secret ? { 'x-internal-secret': secret } : {},
            signal: ac.signal,
          });
          if (!res.ok) {
            const log = this.fileLogger.create('config-client/get-email-config', {
              url: `${configUrl}/email`,
              status: res.status,
            });
            log.addDebug('config_service_error', { status: res.status });
            log.save();
            return null;
          }
          const body = await res.json();
          return (body?.data ?? body) as EmailConfig;
        } finally {
          clearTimeout(timer);
        }
      });
    } catch (err: any) {
      const log = this.fileLogger.create('config-client/get-email-config', {
        url: `${configUrl}/email`,
      });
      log.addException(err);
      log.addDebug('fetch_failed');
      log.save();
      return null;
    }
  }
}
