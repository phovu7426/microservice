import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { MetricsModule } from "@package/bootstrap";
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { Reflector } from '@nestjs/core';
import { I18nModule, QueryResolver, AcceptLanguageResolver } from 'nestjs-i18n';
import { join } from 'path';
import { createAppConfig, createKafkaConfig, createRedisConfig } from '@package/config';
import { envValidationSchema } from './core/config/env.validation';
import { CoreModule } from './core/core.module';
import { RedisModule, RedisService } from '@package/redis';
import { KafkaProducerService } from '@package/kafka-client';
import { JwtGuard, RbacGuard, GlobalExceptionFilter, HealthModule, CommonEventModule, AuditModule, BigIntSerializationInterceptor, SessionModule, SessionContextMiddleware } from '@package/common';
import { PrismaService } from './core/database/prisma.service';
import { ThrottlerGuard } from '@nestjs/throttler';
import { KafkaModule } from './event/kafka/kafka.module';
import { RabbitmqModule } from './event/rabbitmq/rabbitmq.module';
import { RedisEventModule } from './event/redis/redis.module';

import { PostModule } from './modules/post/post.module';
import { CategoryModule } from './modules/category/category.module';
import { TagModule } from './modules/tag/tag.module';
import { CommentModule } from './modules/comment/comment.module';
import { StatsModule } from './modules/stats/stats.module';

function selectMessagingModule() {
  switch (process.env.EVENT_DRIVER) {
    case 'rabbitmq': return RabbitmqModule;
    case 'redis':    return RedisEventModule;
    default:         return KafkaModule;
  }
}
const messagingModule = selectMessagingModule();

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '.env.production', '.env.local'],
      load: [createAppConfig(3008), createKafkaConfig(), createRedisConfig('redis://localhost:6384')],
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
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 60 }]),
    CoreModule,
    RedisModule,
    CommonEventModule,
    messagingModule,
    HealthModule.register({
      serviceName: 'post-service',
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
        ...(!process.env.EVENT_DRIVER || process.env.EVENT_DRIVER === 'kafka'
          ? [{ provide: 'HEALTH_KAFKA_PROBE', inject: [KafkaProducerService], useFactory: (kafka: KafkaProducerService) => () => kafka.ping() }]
          : []),
      ],
    }),
    MetricsModule,
    AuditModule,
    SessionModule,
    PostModule,
    CategoryModule,
    TagModule,
    CommentModule,
    StatsModule,
  ],
  providers: [
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
    // ThrottlerGuard first — `@Throttle(...)` decorators are inert without it.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    {
      provide: APP_GUARD,
      useFactory: (reflector: Reflector, config: ConfigService) =>
        new JwtGuard(reflector, config),
      inject: [Reflector, ConfigService],
    },
    // RbacGuard MUST follow JwtGuard. Without this, `@Permission(...)` is
    // decoration-only and any authenticated user reaches admin endpoints.
    {
      provide: APP_GUARD,
      useFactory: (reflector: Reflector, config: ConfigService, redis: RedisService) =>
        new RbacGuard(reflector, config, redis),
      inject: [Reflector, ConfigService, RedisService],
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: BigIntSerializationInterceptor,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(SessionContextMiddleware).forRoutes('*path');
  }
}
