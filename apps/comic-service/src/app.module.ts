import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { MetricsModule } from "@package/bootstrap";
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';
import { I18nModule, AcceptLanguageResolver, QueryResolver } from 'nestjs-i18n';
import { join } from 'path';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { Reflector } from '@nestjs/core';
import { createAppConfig, createKafkaConfig, createRedisConfig } from '@package/config';
import { envValidationSchema } from './core/config/env.validation';
import { CoreModule } from './core/core.module';
import { RedisModule, RedisService } from '@package/redis';
import { KafkaProducerService } from '@package/kafka-client';
import { JwtGuard, RbacGuard, GlobalExceptionFilter, HealthModule, CommonKafkaModule, AuditModule, BigIntSerializationInterceptor, SessionModule, SessionContextMiddleware } from '@package/common';
import { PrismaService } from './core/database/prisma.service';
import { ThrottlerGuard } from '@nestjs/throttler';
import { KafkaModule } from './kafka/kafka.module';
import { RabbitmqModule } from './rabbitmq/rabbitmq.module';

import { ComicModule } from './modules/comic/comic.module';
import { ChapterModule } from './modules/chapter/chapter.module';
import { CategoryModule } from './modules/category/category.module';
import { CommentModule } from './modules/comment/comment.module';
import { ReviewModule } from './modules/review/review.module';
import { BookmarkModule } from './modules/bookmark/bookmark.module';
import { FollowModule } from './modules/follow/follow.module';
import { ReadingHistoryModule } from './modules/reading-history/reading-history.module';
import { StatsModule } from './modules/stats/stats.module';
import { HomepageModule } from './modules/homepage/homepage.module';
import { ViewTrackingModule } from './modules/view-tracking/view-tracking.module';

const messagingModule = process.env.EVENT_DRIVER === 'rabbitmq' ? RabbitmqModule : KafkaModule;

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '.env.local'],
      load: [createAppConfig(3001), createKafkaConfig(), createRedisConfig()],
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
    CommonKafkaModule,
    messagingModule,
    HealthModule.register({
      serviceName: 'comic-service',
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
    ComicModule,
    ChapterModule,
    CategoryModule,
    CommentModule,
    ReviewModule,
    BookmarkModule,
    FollowModule,
    ReadingHistoryModule,
    StatsModule,
    HomepageModule,
    ViewTrackingModule,
  ],
  providers: [
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
    // ThrottlerGuard first so `@Throttle(...)` decorators actually run.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    {
      provide: APP_GUARD,
      useFactory: (reflector: Reflector, config: ConfigService) =>
        new JwtGuard(reflector, config),
      inject: [Reflector, ConfigService],
    },
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
