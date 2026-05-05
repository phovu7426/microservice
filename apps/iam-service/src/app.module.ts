import { Module } from '@nestjs/common';
import { MetricsModule } from '@package/bootstrap';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { Reflector } from '@nestjs/core';
import { I18nModule, AcceptLanguageResolver, QueryResolver } from 'nestjs-i18n';
import { join } from 'path';
import { createAppConfig, createRedisConfig } from '@package/config';
import {
  JwtGuard,
  GlobalExceptionFilter,
  HealthModule,
  AuditModule,
  BigIntSerializationInterceptor,
} from '@package/common';
import { RedisModule } from '@package/redis';
import { envValidationSchema } from './core/config/env.validation';
import { CoreModule } from './core/core.module';
import { RbacModule } from './rbac/rbac.module';
import { InternalModule } from './internal/internal.module';
import { PermissionModule } from './modules/permission/permission.module';
import { RoleModule } from './modules/role/role.module';
import { ContextModule } from './modules/context/context.module';
import { GroupModule } from './modules/group/group.module';
import { UserRoleModule } from './modules/user-role/user-role.module';
import { KafkaModule } from './kafka/kafka.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '.env.local'],
      load: [
        createAppConfig(3008, {
          internalApiSecret: process.env.INTERNAL_API_SECRET || '',
        }),
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
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 60 }]),
    CoreModule,
    RedisModule,
    RbacModule,
    HealthModule.register('iam-service'),
    MetricsModule,
    AuditModule,
    InternalModule,
    PermissionModule,
    RoleModule,
    ContextModule,
    GroupModule,
    UserRoleModule,
    KafkaModule,
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
export class AppModule {}
