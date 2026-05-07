# Comic Platform — Microservices Monorepo

## Tong quan

Backend nen tang truyen tranh: NestJS + Prisma, microservices monorepo.
10 service (`apps/`), 8 shared packages (`shared/`), PostgreSQL + Redis + Kafka + Nginx.

## Lenh thuong dung

```bash
npm install                              # Cai dat (tu dong build shared)
npm run dev                              # Chay tat ca 10 service (hot-reload)
npm run dev:<ten>                        # auth|comic|config|web-api|iam|introduction|marketing|notification|post|storage
npm run build:shared                     # Build shared (BAT BUOC truoc khi build service)
npm run build                            # Build tat ca
npm run prisma:migrate                   # Migrate dev
npm run prisma:deploy                    # Migrate production
npm run docker:infra                     # Chay infra Docker
npm test                                 # Test
```

## Bang Service

| Service | Port | Prefix |
|---------|-----:|--------|
| auth-service | 3001 | /api/auth |
| iam-service | 3002 | /api/iam |
| config-service | 3003 | /api/config |
| storage-service | 3004 | /api/storage |
| notification-service | 3005 | /api/notifications |
| marketing-service | 3006 | /api/marketing |
| introduction-service | 3007 | /api/introduction |
| post-service | 3008 | /api/posts |
| comic-service | 3009 | /api/comics |
| web-api-service | 3010 | /api/web |

## Chuan muc code (ap dung cho chuc nang moi)

### Controller
- `@Permission()` cho admin, `@Public()` cho public, `@Internal()` + `@UseGuards(InternalGuard)` cho noi bo
- `@AuditLog({ action })` cho create/update/delete (shared/common)
- `ParseBigIntPipe` cho route param: `@Param('id', ParseBigIntPipe) id: bigint`
- Lay user tu `req.user.sub`, truyen actorId xuong service

### Service
- Ke thua `BaseService` tu `@package/common` (co san getList, getOne, create, update, delete)
- Override lifecycle hooks: `beforeCreate`, `afterCreate`, `beforeUpdate`, `afterUpdate`, `beforeDelete`, `afterDelete`, `prepareFilters`, `transform`
- Tra ve ResponseUtil format tu dong qua TransformInterceptor

### Repository
- Ke thua `PrismaRepository` tu `@package/common` (co san findAll, findById, create, update, delete, count, exists)
- Override `buildWhere()` cho filter logic rieng

### DTO
- Ke thua `BaseListQueryDto` cho list endpoint (page, limit, search, sort, skipCount)
- class-validator decorators, @MaxLength cho string

### Response
- TransformInterceptor tu dong wrap: `{ success, data, meta, timestamp }`
- Hoac dung ResponseUtil khi can custom: success, paginated, created, deleted

### Error
- Dung NestJS exceptions + i18n: `throw new NotFoundException(t(this.i18n, 'domain.NOT_FOUND'))`
- GlobalExceptionFilter bat tat ca, wrap thanh ApiResponse

## Shared packages co san

| Package | Chuc nang chinh |
|---------|-----------------|
| `@package/common` | BaseService, PrismaRepository, guards, decorators, ResponseUtil, SlugHelper, ParseBigIntPipe, SanitizeHtmlPipe, AuditLog, GlobalExceptionFilter |
| `@package/bootstrap` | createApp(), JsonLogger, FileLogger, MetricsModule |
| `@package/config` | createAppConfig(), createKafkaConfig(), createRedisConfig() |
| `@package/redis` | RedisService (get/set/del/incr + pub/sub + hash + set) |
| `@package/kafka-client` | KafkaProducerService.emit(topic, payload), KafkaClientModule |
| `@package/shared-types` | Event interfaces (ChapterPublished, UserRegistered, MailSend...) |
| `@package/circuit-breaker` | createCircuitBreaker() |
| `@package/tracing` | initTracing() — OpenTelemetry |
| `@package/auth-client` | JwtLocalGuard cho microservice |

## Quy tac

- Code xong PHAI viet unit test. Test dat trong `apps/<service>/tests/`, mirror theo cau truc `src/modules/`. File test dat ten `*.spec.ts`. Mock dependencies (Prisma, Redis, external services) — KHONG goi DB/Redis that. Chay `npm test -w apps/<service>` xac nhan PASS truoc khi coi la hoan thanh.
- File .env trong `apps/<service>/.env` — KHONG o root
- INTERNAL_API_SECRET giong nhau tren moi service
- Build shared truoc: `npm run build:shared`
- Production dung `prisma migrate deploy`, KHONG `migrate dev`
- Moi service 1 DB rieng
- Naming: file kebab-case, class PascalCase, bien camelCase, constant UPPER_SNAKE_CASE
