import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { MetricsModule } from '@package/bootstrap';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { Reflector } from '@nestjs/core';
import { createAppConfig, createKafkaConfig } from '@package/config';
import { envValidationSchema } from './core/config/env.validation';

import { CoreModule } from './core/core.module';
import { RedisModule, RedisService } from '@package/redis';
import { KafkaProducerService } from '@package/kafka-client';
import {
  JwtGuard,
  RbacGuard,
  GlobalExceptionFilter,
  HealthModule,
  CommonEventModule,
  BigIntSerializationInterceptor,
  SessionModule,
  SessionContextMiddleware,
} from '@package/common';
import { PrismaService } from './core/database/prisma.service';
import { ThrottlerGuard } from '@nestjs/throttler';
import { KafkaModule } from './event/kafka/kafka.module';
import { RabbitmqModule } from './event/rabbitmq/rabbitmq.module';
import { RedisEventModule } from './event/redis/redis.module';

// Introduction modules
import { AboutModule } from './modules/about/about.module';
import { StaffModule } from './modules/staff/staff.module';
import { ProjectModule } from './modules/project/project.module';
import { TestimonialModule } from './modules/testimonial/testimonial.module';
import { PartnerModule } from './modules/partner/partner.module';
import { GalleryModule } from './modules/gallery/gallery.module';
import { CertificateModule } from './modules/certificate/certificate.module';
import { FaqModule } from './modules/faq/faq.module';

// Marketing modules
import { BannerModule } from './modules/banner/banner.module';
import { BannerLocationModule } from './modules/banner-location/banner-location.module';
import { ContactModule } from './modules/contact/contact.module';

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
      load: [createAppConfig(3006), createKafkaConfig()],
      validationSchema: envValidationSchema,
    }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 60 }]),
    CoreModule,
    RedisModule,
    CommonEventModule,
    messagingModule,
    HealthModule.register({
      serviceName: 'cms-service',
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
    SessionModule,
    // Introduction modules
    AboutModule,
    StaffModule,
    ProjectModule,
    TestimonialModule,
    PartnerModule,
    GalleryModule,
    CertificateModule,
    FaqModule,
    // Marketing modules
    BannerModule,
    BannerLocationModule,
    ContactModule,
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
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(SessionContextMiddleware).forRoutes('*path');
  }
}
