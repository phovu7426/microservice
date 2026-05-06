import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCircuitBreaker } from '@package/circuit-breaker';

export interface EmailConfig {
  smtp_host: string;
  smtp_port: number;
  smtp_secure: boolean;
  smtp_username: string;
  smtp_password: string;
  from_email: string;
  from_name?: string;
  reply_to_email?: string;
}

@Injectable()
export class ConfigClient {
  private readonly logger = new Logger(ConfigClient.name);
  private readonly breaker = createCircuitBreaker({
    halfOpenAfterMs: 10_000,
    maxConsecutiveFailures: 5,
  });

  constructor(private readonly config: ConfigService) {
    this.breaker.onBreak(() => {
      this.logger.warn('Config-service circuit opened — service unavailable');
    });
  }

  async getEmailConfig(): Promise<EmailConfig | null> {
    const configUrl = this.config.get<string>('CONFIG_INTERNAL_URL');
    if (!configUrl) return null;

    try {
      return await this.breaker.execute(async () => {
        const secret =
          this.config.get<string>('INTERNAL_API_SECRET') ||
          this.config.get<string>('INTERNAL_SECRET');

        const ac = new AbortController();
        const timer = setTimeout(() => ac.abort(), 5_000);
        try {
          const res = await fetch(`${configUrl}/config/email`, {
            headers: secret ? { 'x-internal-secret': secret } : {},
            signal: ac.signal,
          });
          if (!res.ok) {
            this.logger.warn(`Config-service returned ${res.status} when fetching email config`);
            return null;
          }
          return (await res.json()) as EmailConfig;
        } finally {
          clearTimeout(timer);
        }
      });
    } catch (err: any) {
      this.logger.warn(`Failed to fetch email config: ${err?.message ?? err}`);
      return null;
    }
  }
}
