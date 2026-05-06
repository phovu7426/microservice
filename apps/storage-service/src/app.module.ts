import { Module } from '@nestjs/common';
import { MetricsModule } from '@package/bootstrap';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { Reflector } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { I18nModule, AcceptLanguageResolver, QueryResolver } from 'nestjs-i18n';
import { join } from 'path';
import storageConfig from './core/config/storage.config';
import { envValidationSchema } from './core/config/env.validation';
import { JwtGuard, RbacGuard, GlobalExceptionFilter, HealthModule, BigIntSerializationInterceptor } from '@package/common';
import { CoreModule } from './core/core.module';
import { UploadModule } from './modules/upload/upload.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '.env.local'],
      load: [storageConfig],
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
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 10 }]),
    CoreModule,
    UploadModule,
    HealthModule.register('storage-service'),
    MetricsModule,
  ],
  providers: [
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    {
      provide: APP_GUARD,
      useFactory: (reflector: Reflector, config: ConfigService) => new JwtGuard(reflector, config),
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
export class StorageAppModule {}
