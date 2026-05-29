import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AuditLogInterceptor } from './audit-log.interceptor';

/**
 * Drop-in module that wires the AuditLogInterceptor as a global interceptor.
 * Add to AppModule.imports — no further wiring needed:
 *
 *   imports: [..., AuditModule]
 *
 * Then use `@AuditLog({ action: 'user.delete' })` on any handler whose
 * outcome should land in the audit trail.
 */
@Module({
  providers: [
    { provide: APP_INTERCEPTOR, useClass: AuditLogInterceptor },
  ],
})
export class AuditModule {}
