import { Injectable, MiddlewareConsumer, Module, NestMiddleware, NestModule } from '@nestjs/common';
import {
  PrometheusModule,
  makeCounterProvider,
  makeHistogramProvider,
  InjectMetric,
} from '@willsoto/nestjs-prometheus';
import { Counter, Histogram } from 'prom-client';
import { Request, Response, NextFunction } from 'express';

// Prefixed with `app_` to avoid name collisions with the default counters
// shipped by `prom-client` / `@willsoto/nestjs-prometheus` (they reserve the
// unprefixed `http_requests_total` etc., which silently break DI when you
// re-register the same name in your own module).
const HTTP_REQUESTS_TOTAL = 'app_http_requests_total';
const HTTP_DURATION = 'app_http_request_duration_seconds';

/**
 * Records the four golden signals per HTTP request. Registered as a
 * NestMiddleware so DI can inject the counter + histogram cleanly. Module
 * classes themselves can't reliably take provider injections in NestJS,
 * which is why this lives as a separate class.
 */
@Injectable()
export class MetricsMiddleware implements NestMiddleware {
  constructor(
    @InjectMetric(HTTP_REQUESTS_TOTAL) private readonly counter: Counter<string>,
    @InjectMetric(HTTP_DURATION) private readonly histogram: Histogram<string>,
  ) {}

  use(req: Request, res: Response, next: NextFunction): void {
    const start = process.hrtime.bigint();
    res.on('finish', () => {
      // route comes from Express after match; falls back to a path-shaped
      // label so high-cardinality URLs don't blow up Prometheus storage.
      const route = (req as any).route?.path ?? (req.baseUrl ?? '') + (req.path || '');
      const labels = {
        method: req.method,
        route: route || 'unknown',
        status: String(res.statusCode),
      };
      const seconds = Number(process.hrtime.bigint() - start) / 1e9;
      this.counter.inc(labels);
      this.histogram.observe(labels, seconds);
    });
    next();
  }
}

/**
 * Drop-in metrics module: exposes `/<global-prefix>/metrics` and records
 * RED metrics (rate, errors, duration) per request via MetricsMiddleware.
 *
 * Wire into AppModule:
 *   imports: [..., MetricsModule]
 */
@Module({
  imports: [
    PrometheusModule.register({
      // Path is relative to the global prefix (e.g. /api/auth/metrics)
      path: '/metrics',
      defaultLabels: {
        service: process.env.SERVICE_NAME ?? 'unknown',
      },
      defaultMetrics: { enabled: true },
    }),
  ],
  providers: [
    makeCounterProvider({
      name: HTTP_REQUESTS_TOTAL,
      help: 'Count of HTTP requests by route, method, and status',
      labelNames: ['method', 'route', 'status'],
    }),
    makeHistogramProvider({
      name: HTTP_DURATION,
      help: 'HTTP request duration in seconds',
      labelNames: ['method', 'route', 'status'],
      buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
    }),
    MetricsMiddleware,
  ],
})
export class MetricsModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(MetricsMiddleware).forRoutes('*path');
  }
}
