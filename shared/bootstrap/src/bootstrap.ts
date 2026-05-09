import 'reflect-metadata';
import { initTracing } from '@package/tracing';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Logger, ValidationPipe } from '@nestjs/common';
import { TransformInterceptor } from '@package/common';
import { randomUUID } from 'crypto';
import helmet from 'helmet';
import { json, urlencoded } from 'express';
import cookieParser from 'cookie-parser';
import { JsonLogger } from './json-logger';

// Permitted set of inbound `x-request-id` header values. Anything outside
// this character class is replaced with a fresh uuid to defeat header
// injection / log-poisoning via control characters.
const SAFE_REQUEST_ID_RE = /^[A-Za-z0-9._-]{1,128}$/;

export interface BootstrapOptions {
  serviceName: string;
  defaultPort: number;
  module: any;
  /** Paths to exclude from global prefix (e.g. ['.well-known/*path'] for auth-service JWKS) */
  excludePrefixes?: string[];
}

export async function createApp(options: BootstrapOptions): Promise<NestExpressApplication> {
  // Initialize OpenTelemetry tracing BEFORE NestJS boots so the HTTP and
  // Nest instrumentations can patch modules before they are required.
  // Only activates when the OTLP endpoint env var is set.
  if (process.env.OTEL_EXPORTER_OTLP_ENDPOINT) {
    initTracing(options.serviceName);
  }

  process.env.TZ = process.env.APP_TIMEZONE || 'Asia/Ho_Chi_Minh';

  const serviceName = process.env.SERVICE_NAME ?? options.serviceName;

  const app = await NestFactory.create<NestExpressApplication>(options.module, {
    bufferLogs: true,
    logger: new JsonLogger(serviceName),
  });

  const port = parseInt(process.env.PORT ?? String(options.defaultPort), 10);
  const prefix = process.env.GLOBAL_PREFIX ?? 'api';
  const isProd = process.env.NODE_ENV === 'production';

  if (options.excludePrefixes?.length) {
    app.setGlobalPrefix(prefix, { exclude: options.excludePrefixes });
  } else {
    app.setGlobalPrefix(prefix);
  }

  app.use(cookieParser());
  app.use(json({ limit: '1mb' }));
  app.use(urlencoded({ extended: true, limit: '1mb' }));

  // Request-ID middleware: trust an upstream `x-request-id` if it looks
  // sane, otherwise mint a fresh uuid. Echoed on the response so log
  // shippers can correlate client → gateway → service traces even when
  // OpenTelemetry isn't enabled.
  app.use((req: any, res: any, next: () => void) => {
    const incoming = req.headers?.['x-request-id'];
    const candidate = typeof incoming === 'string' && SAFE_REQUEST_ID_RE.test(incoming)
      ? incoming
      : randomUUID();
    req.requestId = candidate;
    res.setHeader('x-request-id', candidate);
    next();
  });

  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'none'"],
        frameAncestors: ["'none'"],
      },
    },
  }));

  const corsEnabled = process.env.CORS_ENABLED !== 'false';
  if (corsEnabled) {
    const raw = process.env.CORS_ORIGINS?.trim();
    if (isProd && (!raw || raw === '*')) {
      throw new Error(
        'CORS_ORIGINS must be a non-empty, explicit list in production (wildcard "*" is not allowed).',
      );
    }
    const corsOrigins = raw ? raw.split(',').map((s) => s.trim()).filter(Boolean) : '*';
    app.enableCors({
      origin: corsOrigins,
      credentials: true,
      methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    });
  }
  app.enableShutdownHooks();

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );

  app.useGlobalInterceptors(new TransformInterceptor());

  await app.listen(port);
  // Use Nest's Logger so the structured-log shipper (pino/winston) and OTel
  // logs bridge can consume the startup line. Previously a raw console.log
  // bypassed both.
  new Logger('Bootstrap').log(
    `${serviceName} running on http://localhost:${port}/${prefix}`,
  );

  return app;
}
