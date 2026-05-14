import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { MetricsModule } from '@package/bootstrap';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { Reflector } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { I18nModule, AcceptLanguageResolver, QueryResolver } from 'nestjs-i18n';
import { join } from 'path';
import { createAppConfig } from '@package/config';
import { envValidationSchema } from './core/config/env.validation';
import { JwtGuard, RbacGuard, GlobalExceptionFilter, HealthModule, BigIntSerializationInterceptor, SessionModule, SessionContextMiddleware } from '@package/common';
import { RedisModule, RedisService } from '@package/redis';
import { CoreModule } from './core/core.module';
import { PrismaService } from './core/database/prisma.service';
import { InternalModule } from './internal/internal.module';
import { SystemConfigModule } from './modules/system-config/system-config.module';
import { MenuModule } from './modules/menu/menu.module';
import { LocationModule } from './modules/location/location.module';
import { CachePurgeModule } from './modules/cache-purge/cache-purge.module';
import { PermissionModule } from './modules/permission/permission.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '.env.local'],
      load: [createAppConfig(3003, { internalApiSecret: process.env.INTERNAL_API_SECRET || '' })],
      validationSchema: envValidationSchema,
    }),
    I18nModule.forRoot({
      fallbackLanguage: 'en',
      loaderOptions: {
        path: join(__dirname, 'i18n'),
        watch: process.env.NODE_ENV !== 'production',
      },
      resolvers: [
        { use: QueryResolver, options: ['lang'] },
        AcceptLanguageResolver,
      ],
    }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 60 }]),
    RedisModule,
    CoreModule,
    HealthModule.register({
      serviceName: 'config-service',
      probes: [
        {
          provide: 'HEALTH_DB_PROBE',
          inject: [PrismaService],
          useFactory: (prisma: PrismaService) => () => prisma.$queryRawUnsafe('SELECT 1').then(() => {}),
        },
        {
          provide: 'HEALTH_REDIS_PROBE',
          inject: [RedisService],
          useFactory: (redis: RedisService) => () => redis.ping(),
        },
      ],
    }),
    MetricsModule,
    SessionModule,
    InternalModule,
    SystemConfigModule,
    MenuModule,
    LocationModule,
    CachePurgeModule,
    PermissionModule,
  ],
  providers: [
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard
    },
    {
      provide: APP_GUARD,
      useFactory: (reflector: Reflector, config: ConfigService) =>
        new JwtGuard(reflector, config),
      inject: [Reflector, ConfigService],
    },
    {
      provide: APP_GUARD,
      useFactory: (reflector: Reflector, config: ConfigService) =>
        new RbacGuard(reflector, config),
      inject: [Reflector, ConfigService],
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: BigIntSerializationInterceptor,
    },
  ],
})
export class ConfigAppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(SessionContextMiddleware).forRoutes('*path');
  }
}
