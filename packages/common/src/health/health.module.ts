import { Module, DynamicModule, Type } from '@nestjs/common';
import { HealthController } from './health.controller';

export interface HealthModuleOptions {
  serviceName: string;
  /**
   * Optional imports needed to resolve probe dependencies
   * (e.g. modules that export PrismaService, RedisService, KafkaProducerService).
   */
  imports?: Array<Type<any> | DynamicModule | Promise<DynamicModule> | any>;
  /**
   * Optional factory providers for probes.
   * Each entry provides one of: HEALTH_DB_PROBE, HEALTH_REDIS_PROBE, HEALTH_KAFKA_PROBE.
   */
  probes?: Array<{
    provide: string;
    useFactory: (...args: any[]) => () => Promise<void>;
    inject?: any[];
  }>;
}

@Module({})
export class HealthModule {
  static register(optionsOrName: string | HealthModuleOptions): DynamicModule {
    const options: HealthModuleOptions =
      typeof optionsOrName === 'string'
        ? { serviceName: optionsOrName }
        : optionsOrName;

    return {
      module: HealthModule,
      imports: options.imports || [],
      controllers: [HealthController],
      providers: [
        { provide: 'HEALTH_SERVICE_NAME', useValue: options.serviceName },
        ...(options.probes || []),
      ],
    };
  }
}
