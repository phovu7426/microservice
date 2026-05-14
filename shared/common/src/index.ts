// Decorators
export { Permission, Public, Internal, PERMS_KEY } from './decorators/permission.decorator';

// Filters
export { GlobalExceptionFilter } from './filters/global-exception.filter';

// Guards
export { JwtGuard } from './guards/jwt.guard';
export { InternalGuard } from './guards/internal.guard';
export { RbacGuard } from './guards/rbac.guard';

// Interceptors
export { BigIntSerializationInterceptor } from './interceptors/bigint-serialization.interceptor';
export { TransformInterceptor } from './response/transform.interceptor';
export { RequestLoggerInterceptor } from './interceptors/request-logger.interceptor';

// Response
export { ResponseUtil, ApiResponse, PaginationMeta as ResponsePaginationMeta } from './response/response.util';
export { formatResponseTimestamp } from './response/response-timestamp.helper';

// Helpers
export { createPaginationMeta, parseQueryOptions, DEFAULT_MAX_TAKE, MAX_PAGE, type PaginationMeta, type QueryOptions } from './helpers/pagination.helper';

// Shared DTOs
export { BaseListQueryDto } from './dtos/base-list-query.dto';
export { parseDurationToSeconds } from './helpers/duration.helper';
export { t } from './helpers/i18n.helper';
export { LruSet } from './helpers/lru-set.helper';
export { SlugHelper } from './helpers/slug.helper';
export { EnumModule, type EnumItem } from './helpers/enum-module.helper';
export { SanitizeHtmlPipe } from './pipes/sanitize-html.pipe';
export { ParseBigIntPipe } from './pipes/parse-bigint.pipe';
export { ImageValidator } from './validators/image-validator';

// Database — PrismaService/DatabaseModule stay LOCAL in each service
// because each service generates its own PrismaClient from its own schema.

// Repository pattern
export { PrismaRepository, PrismaDelegate, IPaginatedResult, IPaginationOptions, prepareQuery } from './repository/prisma.repository';

// Base service
export { BaseService, IRepository } from './services/base.service';

// Health
export { HealthModule } from './health/health.module';
export { HealthController } from './health/health.controller';

// Kafka outbox
export { OutboxRelayService, OutboxRelayOptions, KAFKA_PRODUCER } from './kafka/outbox-relay.service';
export type { IKafkaProducer } from './kafka/outbox-relay.service';
export { IdempotencyService } from './kafka/idempotency.service';
export { CommonKafkaModule } from './kafka/kafka-common.module';

// Audit log
export { AuditLog, AUDIT_LOG_KEY, AuditLogMeta } from './audit/audit-log.decorator';
export { AuditLogInterceptor } from './audit/audit-log.interceptor';
export { AuditModule } from './audit/audit.module';

// Session context
export { SessionContext, SessionServerInfo } from './session/session-context';
export { SessionContextService } from './session/session-context.service';
export { SessionContextMiddleware } from './session/session-context.middleware';
export { SessionModule } from './session/session.module';
export { session } from './session/session-context.storage';
export { getSessionGroupId } from './session/group-filter.helper';
