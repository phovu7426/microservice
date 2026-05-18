import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { MetricsModule } from '@package/bootstrap';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import * as path from 'path';
import cookieParser = require('cookie-parser');
import { I18nModule, AcceptLanguageResolver, QueryResolver } from 'nestjs-i18n';
import { createAppConfig, createKafkaConfig, createRedisConfig } from '@package/config';
import { RedisModule, RedisService } from '@package/redis';
import { AuditModule, GlobalExceptionFilter, HealthModule, CommonKafkaModule, BigIntSerializationInterceptor, SessionModule, SessionContextMiddleware } from '@package/common';
import { KafkaProducerService } from '@package/kafka-client';
import { PrismaService } from './core/database/prisma.service';
import { CoreModule } from './core/core.module';
import { envValidationSchema } from './core/config/env.validation';
import jwtConfig from './core/config/jwt.config';
import { AuthJwtGuard } from './core/guards/auth-jwt.guard';
import { I18nThrottlerGuard } from './core/guards/throttler.guard';
import { JwksModule } from './jwks/jwks.module';
import { KafkaModule } from './kafka/kafka.module';
import { RabbitmqModule } from './rabbitmq/rabbitmq.module';
import { AuthModule } from './modules/auth/auth.module';
import { UserModule } from './modules/user/user.module';
import { InternalModule } from './internal/internal.module';

const messagingModule = process.env.EVENT_DRIVER === 'rabbitmq' ? RabbitmqModule : KafkaModule;

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '.env.local'],
      load: [
        createAppConfig(3001, {
          internalApiSecret: process.env.INTERNAL_API_SECRET || '',
        }),
        jwtConfig,
        createKafkaConfig(),
        createRedisConfig(),
      ],
      validationSchema: envValidationSchema,
    }),
    I18nModule.forRoot({
      fallbackLanguage: 'vi',
      loaderOptions: {
        path: path.join(__dirname, 'i18n'),
        watch: process.env.NODE_ENV !== 'production',
      },
      resolvers: [
        { use: QueryResolver, options: ['lang'] },
        AcceptLanguageResolver,
      ],
    }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 60 }]),
    CoreModule,
    RedisModule,
    JwksModule,
    AuthModule,
    CommonKafkaModule,
    messagingModule,
    HealthModule.register({
      serviceName: 'auth-service',
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
        ...(process.env.EVENT_DRIVER !== 'rabbitmq'
          ? [{ provide: 'HEALTH_KAFKA_PROBE', inject: [KafkaProducerService], useFactory: (kafka: KafkaProducerService) => () => kafka.ping() }]
          : []),
      ],
    }),
    MetricsModule,
    AuditModule,
    SessionModule,
    InternalModule,
    UserModule,
  ],
  providers: [
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
    { 
      provide: APP_GUARD,
      useClass: I18nThrottlerGuard
    },
    { provide: APP_GUARD, useClass: AuthJwtGuard },
    {
      provide: APP_INTERCEPTOR,
      useClass: BigIntSerializationInterceptor,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(cookieParser(), SessionContextMiddleware).forRoutes('*path');
  }
}
