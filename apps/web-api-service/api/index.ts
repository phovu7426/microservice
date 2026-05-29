import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import { TransformInterceptor } from '@package/common';
import cookieParser from 'cookie-parser';
import compression from 'compression';
import { json, urlencoded } from 'express';
import helmet from 'helmet';
import { randomUUID } from 'crypto';
import type { IncomingMessage, ServerResponse } from 'http';
import { GatewayAppModule } from '../src/app.module';

const SAFE_REQUEST_ID_RE = /^[A-Za-z0-9._-]{1,128}$/;

let app: NestExpressApplication;

async function bootstrap() {
  if (app) return app;

  app = await NestFactory.create<NestExpressApplication>(GatewayAppModule, {
    logger: false,
  });

  app.setGlobalPrefix(process.env.GLOBAL_PREFIX ?? 'api');
  app.use(cookieParser());
  app.use(compression());
  app.use(json({ limit: '1mb' }));
  app.use(urlencoded({ extended: true, limit: '1mb' }));
  app.use((req: any, res: any, next: () => void) => {
    const incoming = req.headers?.['x-request-id'];
    const id = typeof incoming === 'string' && SAFE_REQUEST_ID_RE.test(incoming) ? incoming : randomUUID();
    req.requestId = id;
    res.setHeader('x-request-id', id);
    next();
  });
  app.use(helmet({ contentSecurityPolicy: { directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] } } }));

  const raw = process.env.CORS_ORIGINS?.trim();
  const origins = raw ? raw.split(',').map((s) => s.trim()).filter(Boolean) : '*';
  app.enableCors({ origin: origins, credentials: true, methods: ['GET','HEAD','POST','PUT','PATCH','DELETE','OPTIONS'], allowedHeaders: ['Content-Type','Authorization','Accept','X-Requested-With','x-request-id','x-internal-secret'], exposedHeaders: ['x-request-id'] });

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true, transformOptions: { enableImplicitConversion: false } }));
  app.useGlobalInterceptors(new TransformInterceptor());

  await app.init();
  return app;
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const instance = await bootstrap();
  instance.getHttpAdapter().getInstance()(req, res);
}
