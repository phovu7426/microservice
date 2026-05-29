# Comic Platform — Microservices Monorepo

## Tong quan

Backend nen tang truyen tranh: NestJS + Prisma, microservices monorepo (pnpm workspaces).
9 service (`apps/`), 10 shared packages (`packages/`), PostgreSQL + Redis + Kafka + RabbitMQ + Nginx.

## Lenh thuong dung

```bash
pnpm install                             # Cai dat (postinstall tu dong build shared)
pnpm dev                                 # Chay tat ca service (hot-reload)
pnpm dev:<ten>                           # auth|comic|config|web-api|iam|cms|notification|post|storage
pnpm build:shared                        # Build shared (BAT BUOC truoc khi build service)
pnpm build                               # Build tat ca
pnpm prisma:migrate                      # Migrate dev (chay cho tat ca service co prisma)
pnpm prisma:deploy                       # Migrate production
pnpm docker:infra                        # Chay infra Docker
pnpm test                                # Test
```

Yeu cau: Node ≥20, pnpm 11.4.0 (auto-activate qua `corepack enable`).

## Bang Service

| Service | Port | Prefix |
|---------|-----:|--------|
| auth-service | 3001 | /api/auth |
| iam-service | 3002 | /api/iam |
| config-service | 3003 | /api/config |
| storage-service | 3004 | /api/storage |
| notification-service | 3005 | /api/notifications |
| cms-service | 3006 | /api/cms |
| post-service | 3008 | /api/posts |
| comic-service | 3009 | /api/comics |
| web-api-service | 3010 | /api/web |

## Chuan muc code (ap dung cho chuc nang moi)

### Controller
- `@Permission()` cho admin, `@Authenticated()` cho route can login (khong check perm cu the), `@Public()` cho public, `@Internal()` + `@UseGuards(InternalGuard)` cho noi bo
- `@AuditLog({ action })` cho create/update/delete (packages/common)
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

- Code xong PHAI viet unit test. Test dat trong `apps/<service>/tests/`, mirror theo cau truc `src/modules/`. File test dat ten `*.spec.ts`. Mock dependencies (Prisma, Redis, external services) — KHONG goi DB/Redis that. Chay `pnpm --filter <service> test` xac nhan PASS truoc khi coi la hoan thanh.
- File .env trong `apps/<service>/.env` — KHONG o root
- INTERNAL_API_SECRET giong nhau tren moi service
- Build shared truoc: `pnpm build:shared` (hoac `pnpm install` tu dong chay qua postinstall)
- Production dung `prisma migrate deploy`, KHONG `migrate dev`
- Moi service 1 DB rieng
- Naming: file kebab-case, class PascalCase, bien camelCase, constant UPPER_SNAKE_CASE
- Strict pnpm: moi package phai khai bao day du dependencies trong package.json — khong dua vao hoisting. Workspace dep dung protocol `workspace:*`.
