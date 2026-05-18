import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { MetricsModule } from '@package/bootstrap';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { Reflector } from '@nestjs/core';
import { I18nModule, QueryResolver, AcceptLanguageResolver } from 'nestjs-i18n';
import { join } from 'path';
import { createAppConfig, createKafkaConfig, createRedisConfig } from '@package/config';
import { RedisModule, RedisService } from '@package/redis';
import { envValidationSchema } from './core/config/env.validation';
import { JwtGuard, RbacGuard, GlobalExceptionFilter, HealthModule, CommonKafkaModule, BigIntSerializationInterceptor, SessionModule, SessionContextMiddleware } from '@package/common';
import { PrismaService } from './core/database/prisma.service';
import { CoreModule } from './core/core.module';
import { ClientsModule } from './clients/clients.module';
import { InternalModule } from './internal/internal.module';
import { MailModule } from './modules/mail/mail.module';
import { NotificationModule } from './modules/notification/notification.module';
import { ContentTemplateModule } from './modules/content-template/content-template.module';
import { QueueModule } from './queue/queue.module';
import { KafkaModule } from './kafka/kafka.module';
import { RabbitmqModule } from './rabbitmq/rabbitmq.module';

const messagingModule = process.env.EVENT_DRIVER === 'rabbitmq' ? RabbitmqModule : KafkaModule;

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '.env.local'],
      load: [createAppConfig(3004, { internalApiSecret: process.env.INTERNAL_API_SECRET || '' }), createKafkaConfig('notification-service'), createRedisConfig('redis://localhost:6382')],
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
    ClientsModule,
    MailModule,
    CommonKafkaModule,
    messagingModule,
    HealthModule.register({
      serviceName: 'notification-service',
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
    NotificationModule,
    ContentTemplateModule,
    QueueModule,
    InternalModule,
  ],
  providers: [
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
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
export class NotificationAppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(SessionContextMiddleware).forRoutes('*path');
  }
}
