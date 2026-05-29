import { Controller, Get, Inject, Optional, ServiceUnavailableException, SetMetadata } from '@nestjs/common';

const PERMS_KEY = 'perms_required';
const PROBE_TIMEOUT_MS = 5_000;

/**
 * Per-service liveness/readiness probes.
 *
 * - `GET /health` (alias `/health/live`) is a cheap liveness check that
 *   only confirms the process is up. Use for k8s `livenessProbe`.
 * - `GET /health/ready` is the readiness check — pings DB/Redis/Kafka if
 *   they're provided. Returns 503 if any required dependency is down so a
 *   load balancer can take the pod out of rotation. Use for k8s `readinessProbe`.
 */
export type HealthProbe = () => Promise<void>;

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} probe timed out after ${ms}ms`)), ms),
    ),
  ]);
}

@Controller('health')
export class HealthController {
  constructor(
    @Inject('HEALTH_SERVICE_NAME') private readonly serviceName: string,
    @Optional() @Inject('HEALTH_DB_PROBE') private readonly dbProbe?: HealthProbe,
    @Optional() @Inject('HEALTH_REDIS_PROBE') private readonly redisProbe?: HealthProbe,
    @Optional() @Inject('HEALTH_KAFKA_PROBE') private readonly kafkaProbe?: HealthProbe,
  ) {}

  @Get()
  @SetMetadata(PERMS_KEY, ['public'])
  check() {
    return this.live();
  }

  @Get('live')
  @SetMetadata(PERMS_KEY, ['public'])
  live() {
    return {
      status: 'ok',
      service: this.serviceName,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('ready')
  @SetMetadata(PERMS_KEY, ['public'])
  async ready() {
    const checks: Record<string, 'ok' | 'fail'> = {};
    let healthy = true;

    // Build list of probes to run in parallel
    const probes: { key: string; promise: Promise<void> }[] = [];

    if (this.dbProbe) {
      probes.push({ key: 'db', promise: withTimeout(this.dbProbe(), PROBE_TIMEOUT_MS, 'DB') });
    }
    if (this.redisProbe) {
      probes.push({ key: 'redis', promise: withTimeout(this.redisProbe(), PROBE_TIMEOUT_MS, 'Redis') });
    }
    if (this.kafkaProbe) {
      probes.push({ key: 'kafka', promise: withTimeout(this.kafkaProbe(), PROBE_TIMEOUT_MS, 'Kafka') });
    }

    const results = await Promise.allSettled(probes.map((p) => p.promise));

    for (let i = 0; i < probes.length; i++) {
      if (results[i].status === 'fulfilled') {
        checks[probes[i].key] = 'ok';
      } else {
        checks[probes[i].key] = 'fail';
        healthy = false;
      }
    }

    const body = {
      status: healthy ? 'ok' : 'degraded',
      service: this.serviceName,
      timestamp: new Date().toISOString(),
      checks,
    };
    if (!healthy) throw new ServiceUnavailableException(body);
    return body;
  }
}
