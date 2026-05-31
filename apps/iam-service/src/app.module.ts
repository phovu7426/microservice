import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { MetricsModule } from '@package/bootstrap';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { Reflector } from '@nestjs/core';
import { I18nModule, AcceptLanguageResolver, QueryResolver } from 'nestjs-i18n';
import { join } from 'path';
import { createAppConfig, createKafkaConfig, createRedisConfig } from '@package/config';
import {
  JwtGuard,
  GlobalExceptionFilter,
  HealthModule,
  CommonEventModule,
  AuditModule,
  BigIntSerializationInterceptor,
  SessionModule,
  SessionContextMiddleware,
} from '@package/common';
import { RedisModule, RedisService } from '@package/redis';
import { KafkaProducerService } from '@package/kafka-client';
import { envValidationSchema } from './core/config/env.validation';
import { PrismaService } from './core/database/prisma.service';
import { CoreModule } from './core/core.module';
import { RbacModule } from './rbac/rbac.module';
import { InternalModule } from './internal/internal.module';
import { PermissionModule } from './modules/permission/permission.module';
import { RoleModule } from './modules/role/role.module';
import { GroupModule } from './modules/group/group.module';
import { UserRoleModule } from './modules/user-role/user-role.module';
import { KafkaModule } from './event/kafka/kafka.module';
import { RabbitmqModule } from './event/rabbitmq/rabbitmq.module';
import { RedisEventModule } from './event/redis/redis.module';

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
      load: [
        createAppConfig(3008, {
          internalApiSecret: process.env.INTERNAL_API_SECRET || '',
        }),
        createKafkaConfig('iam-service'),
        createRedisConfig(),
      ],
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
    RbacModule,
    CommonEventModule,
    messagingModule,
    HealthModule.register({
      serviceName: 'iam-service',
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
    InternalModule,
    PermissionModule,
    RoleModule,
    GroupModule,
    UserRoleModule,
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
