import { registerAs } from '@nestjs/config';

export function createRedisConfig(defaultUrl = 'redis://localhost:6381') {
  return registerAs('redis', () => ({
    url: process.env.REDIS_URL || defaultUrl,
  }));
}
