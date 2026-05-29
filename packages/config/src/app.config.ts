import { registerAs } from '@nestjs/config';

export interface AppConfigExtras {
  internalApiSecret?: string;
  frontendUrl?: string;
  [key: string]: unknown;
}

export function createAppConfig(defaultPort: number, extras?: AppConfigExtras) {
  return registerAs('app', () => ({
    port: parseInt(process.env.PORT || String(defaultPort), 10),
    nodeEnv: process.env.NODE_ENV || 'development',
    globalPrefix: process.env.PREFIX || process.env.GLOBAL_PREFIX || 'api',
    corsOrigins: process.env.CORS_ORIGINS
      ? process.env.CORS_ORIGINS.split(',').map((s) => s.trim())
      : ['*'],
    ...(extras ?? {}),
  }));
}
