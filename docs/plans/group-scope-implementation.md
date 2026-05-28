# Group Scope Filtering — Phân tích thay đổi: Shared, IAM, Auth, Config

> Tài liệu bổ sung cho [group-scope-filtering.md](group-scope-filtering.md).
> Phân tích chi tiết từng file cần thay đổi cho đợt đầu tiên: shared common + 3 service.

---

## Tổng quan

```
Shared common ─── SessionContext + helper ──┐
                                            ├── build shared
IAM service ─── internal endpoint mới ──────┤
                                            │
Auth service ─── client + repo + service ───┘

Config service ─── KHÔNG CẦN THAY ĐỔI
```

**Thứ tự:** Shared → build → IAM → Auth

---

## 1. Shared Common (3 file)

### 1.1 `shared/common/src/session/session-context.ts` — SỬA

**Hiện tại:** Class `SessionContext` đọc headers: `x-forwarded-for`, `user-agent`, `accept-language`, `x-request-id`. Có getters cho JWT info (`userId`, `userEmail`, `isAuthenticated`...). Chưa có gì liên quan đến `x-group-id`.

**Thay đổi:** Thêm 2 getter mới cuối class:

```typescript
// --- Thêm sau getter isAuthenticated ---

get groupId(): bigint | null {
  const raw = this.req.headers['x-group-id'] as string | undefined;
  if (!raw) return null;
  try { return BigInt(raw); } catch { return null; }
}

get isSystemContext(): boolean {
  return this.groupId === null;
}
```

**Lý do dùng getter thay vì readonly property:** `groupId` cần parse BigInt, có thể throw — dùng getter + try/catch an toàn hơn. Cũng consistent với pattern `userId` getter hiện có.

**Ảnh hưởng:** Không breaking — chỉ thêm getter mới, code cũ không bị ảnh hưởng.

---

### 1.2 `shared/common/src/session/group-filter.helper.ts` — TẠO MỚI

```typescript
import { session } from './session-context.storage';

/**
 * Trả về groupId bắt buộc khi đang ở group context.
 * Trả về null khi system context (admin toàn hệ thống).
 *
 * Dùng trong service/buildFilter:
 *   const sessionGroupId = getSessionGroupId();
 *   filter.groupId = sessionGroupId ?? query.groupId ?? undefined;
 */
export function getSessionGroupId(): bigint | null {
  const ctx = session();
  if (!ctx || ctx.isSystemContext) return null;
  return ctx.groupId;
}
```

**Tại sao helper riêng thay vì dùng `session()?.groupId` trực tiếp:**
- Tập trung logic "group context = bắt buộc, system context = không" vào 1 chỗ.
- Service chỉ cần biết: `null` = không cần filter, có giá trị = bắt buộc filter.
- Dễ mock trong unit test: `jest.mock('@package/common', () => ({ getSessionGroupId: () => 5n }))`.

---

### 1.3 `shared/common/src/index.ts` — SỬA

**Thay đổi:** Thêm 1 dòng export vào block "Session context" (sau dòng `export { session }`):

```typescript
// Session context
export { SessionContext, SessionServerInfo } from './session/session-context';
export { SessionContextService } from './session/session-context.service';
export { SessionContextMiddleware } from './session/session-context.middleware';
export { SessionModule } from './session/session.module';
export { session } from './session/session-context.storage';
export { getSessionGroupId } from './session/group-filter.helper';  // +thêm
```

---

### 1.4 Build

```bash
npm run build:shared
```

Bắt buộc trước khi sửa bất kỳ service nào.

---

## 2. Config Service — KHÔNG CẦN THAY ĐỔI

### Phân tích schema

| Bảng | Có groupId? | Ghi chú |
|------|:-----------:|---------|
| Menu | ❌ | Có field `group VARCHAR` nhưng dùng để phân loại hiển thị (admin/client), KHÔNG phải multi-tenant |
| GeneralConfig | ❌ | Singleton — 1 bản ghi cho toàn hệ thống |
| EmailConfig | ❌ | Singleton |
| Country | ❌ | Reference data dùng chung |
| Province | ❌ | Reference data dùng chung |
| Ward | ❌ | Reference data dùng chung |

### Phân tích x-group-id hiện tại

Chỉ **1 chỗ** đọc `x-group-id`: `UserMenuController.getUserMenuTree()`:

```typescript
// apps/config-service/src/modules/menu/user/controllers/menu.controller.ts
@Get()
async getUserMenuTree(@Req() req: any) {
  const groupId = req.headers['x-group-id'] as string | undefined;
  return this.service.getUserMenuTree(userId, groupId);
}
```

→ `groupId` được truyền sang IAM service để lấy permissions theo group, **KHÔNG dùng để filter data trong DB config-service**. Logic này đã đúng và hoạt động tốt.

### Kết luận

- Không cần thêm groupId vào bất kỳ bảng nào.
- Không cần filter data theo group.
- Nếu muốn thống nhất code style: có thể đổi `req.headers['x-group-id']` → `session()?.groupId` nhưng là cải thiện nhỏ, không ưu tiên.

---

## 3. IAM Service (3 file)

### 3.1 `apps/iam-service/src/modules/group/repositories/group.repository.ts` — SỬA

**Hiện tại:** Repository đã có `getMembers(groupId, skip, take)` trả về full `UserGroup` objects (userId, groupId, joinedAt) — dùng cho admin list paginated. Chưa có method trả về chỉ danh sách userIds.

**Thay đổi:** Thêm method `findMemberIds()`:

```typescript
/**
 * Trả về danh sách userId thuộc group.
 * Dùng bởi internal API cho auth-service filter user theo group.
 */
async findMemberIds(groupId: bigint): Promise<bigint[]> {
  const records = await this.prisma.userGroup.findMany({
    where: { groupId },
    select: { userId: true },
  });
  return records.map(r => r.userId);
}
```

**Lưu ý performance:** `userGroup` có index trên `groupId` (`@@index([groupId])`) nên query nhanh. Với group rất lớn (>10k members), có thể cần pagination trong tương lai — nhưng hiện tại chấp nhận được vì kết quả được cache ở auth-service.

---

### 3.2 `apps/iam-service/src/internal/group-internal.controller.ts` — TẠO MỚI

**Hiện tại internal module có:**
- `rbac-check.controller.ts` (`/internal/rbac/*`) — RBAC check
- `permission.controller.ts` (`/internal/permissions/*`) — permission list

**Tạo controller mới** cho group internal API:

```typescript
import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { Internal, InternalGuard, ParseBigIntPipe, ResponseUtil } from '@package/common';
import { GroupRepository } from '../modules/group/repositories/group.repository';

@Controller('internal/groups')
@Internal()
@UseGuards(InternalGuard)
export class GroupInternalController {
  constructor(private readonly groupRepo: GroupRepository) {}

  @Get(':id/member-ids')
  async getMemberIds(@Param('id', ParseBigIntPipe) id: bigint) {
    const userIds = await this.groupRepo.findMemberIds(id);
    return ResponseUtil.success({ userIds: userIds.map(String) });
  }
}
```

**Response format:**

```json
{
  "success": true,
  "data": {
    "userIds": ["1", "2", "5", "12"]
  }
}
```

userIds trả về dạng string vì BigInt không serialize được trong JSON.

---

### 3.3 `apps/iam-service/src/internal/internal.module.ts` — SỬA

**Hiện tại:**

```typescript
@Module({
  imports: [PermissionModule],
  controllers: [RbacCheckController, PermissionController],
  providers: [InternalGuard],
})
export class InternalModule {}
```

**Thay đổi:** Import `GroupModule` để có `GroupRepository`, đăng ký controller mới:

```typescript
import { GroupModule } from '../modules/group/group.module';
import { GroupInternalController } from './group-internal.controller';

@Module({
  imports: [PermissionModule, GroupModule],  // +GroupModule
  controllers: [
    RbacCheckController,
    PermissionController,
    GroupInternalController,                 // +thêm
  ],
  providers: [InternalGuard],
})
export class InternalModule {}
```

**Lưu ý:** `GroupModule` hiện chưa export `GroupRepository`. Cần kiểm tra và thêm export nếu cần:

```typescript
// apps/iam-service/src/modules/group/group.module.ts
@Module({
  // ...
  exports: [GroupRepository],  // +thêm nếu chưa có
})
export class GroupModule {}
```

---

## 4. Auth Service (4 file)

### 4.1 `apps/auth-service/src/clients/iam.client.ts` — SỬA

**Hiện tại:** Chỉ có `checkPermissions()` + private `doPost()`. Cần thêm `doGet()` và `getGroupMemberIds()`.

#### a) Thêm `doGet()` helper

Pattern giống `doPost()` nhưng dùng GET, không có body:

```typescript
private async doGet(url: string): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), IAM_TIMEOUT_MS);

  try {
    return await this.breaker.execute(async () => {
      const headers: Record<string, string> = {};
      if (this.internalSecret) headers['x-internal-secret'] = this.internalSecret;

      const res = await fetch(url, {
        method: 'GET',
        headers,
        signal: controller.signal,
      });

      if (!res.ok) throw new Error(`IAM returned ${res.status}`);

      const json = await res.json();
      return json?.data ?? json;
    });
  } finally {
    clearTimeout(timer);
  }
}
```

**Khác biệt với doPost:**
- Không có `Content-Type` header (GET không có body).
- Không `return { allowed: false }` khi `res.status < 500` — nếu lỗi thì throw luôn để caller xử lý.

#### b) Thêm `getGroupMemberIds()` với Redis cache

```typescript
private static readonly GROUP_MEMBERS_CACHE_TTL = 120; // 2 phút

async getGroupMemberIds(groupId: string): Promise<bigint[]> {
  const cacheKey = `group:members:${groupId}`;

  // Cache first
  try {
    const cached = await this.redis.get(cacheKey);
    if (cached) return (JSON.parse(cached) as string[]).map(BigInt);
  } catch { /* Redis unavailable — fall through */ }

  // Call IAM
  const data = await this.doGet(
    `${this.baseUrl}/internal/groups/${groupId}/member-ids`,
  );
  const userIds: string[] = data?.userIds ?? [];

  // Cache result
  try {
    await this.redis.set(
      cacheKey,
      JSON.stringify(userIds),
      IamClient.GROUP_MEMBERS_CACHE_TTL,
    );
  } catch { /* not critical */ }

  return userIds.map(BigInt);
}
```

**Cache strategy:**
- Key: `group:members:{groupId}`
- TTL: 120 giây (2 phút) — đủ ngắn để member changes tự invalidate, đủ dài để giảm load IAM.
- Lưu dạng `string[]` trong Redis vì BigInt không JSON.stringify được.
- Kafka invalidation (tuỳ chọn, bổ sung sau): khi IAM service add/remove member → publish event → auth-service consumer `redis.del(cacheKey)`.

---

### 4.2 `apps/auth-service/src/modules/user/repositories/user-admin.repository.ts` — SỬA

**Hiện tại `buildWhere()`** xử lý: `search`, `status`, `email`, `phone`. Cần thêm `userIds`.

**Thay đổi:** Thêm 1 block vào `buildWhere()`, sau block `query.phone` (dòng ~228):

```typescript
private buildWhere(query: Record<string, any>): Prisma.UserWhereInput {
  const where: Prisma.UserWhereInput = {};
  const andConditions: Prisma.UserWhereInput[] = [];

  // ... existing: search, status, email, phone ...

  // Group scope: filter users by member IDs
  if (query.userIds?.length) {
    andConditions.push({ id: { in: query.userIds } });
  }

  if (andConditions.length > 0) {
    where.AND = andConditions;
  }
  return where;
}
```

**Ảnh hưởng:**
- `findAll()` và `findAllSimple()` đều gọi `buildWhere(query)` nên tự động được filter.
- Không ảnh hưởng nơi khác — `userIds` chỉ được truyền khi group context.

---

### 4.3 `apps/auth-service/src/modules/user/admin/services/user.service.ts` — SỬA

**Hiện tại:**

```typescript
@Injectable()
export class AdminUserService {
  constructor(
    private readonly userRepo: UserAdminRepository,
    private readonly configService: ConfigService,
  ) {}

  async getList(query: UserQueryDto) {
    return this.userRepo.findAll(query);
  }

  async getSimpleList(query: UserQueryDto) {
    return this.userRepo.findAllSimple(query);
  }
  // ...
}
```

**Thay đổi:**

#### a) Thêm dependency `IamClient`:

```typescript
import { getSessionGroupId } from '@package/common';
import { IamClient } from 'src/clients/iam.client';

@Injectable()
export class AdminUserService {
  constructor(
    private readonly userRepo: UserAdminRepository,
    private readonly configService: ConfigService,
    private readonly iamClient: IamClient,             // +thêm
  ) {}
```

#### b) Sửa `getList()`:

```typescript
async getList(query: UserQueryDto) {
  const sessionGroupId = getSessionGroupId();
  if (sessionGroupId) {
    const memberIds = await this.iamClient.getGroupMemberIds(
      String(sessionGroupId),
    );
    if (!memberIds.length) {
      return { data: [], meta: createPaginationMeta(parseQueryOptions(query), 0) };
    }
    return this.userRepo.findAll({ ...query, userIds: memberIds });
  }
  return this.userRepo.findAll(query);
}
```

Import thêm `createPaginationMeta`, `parseQueryOptions` từ `@package/common` (đã được dùng trong repository).

#### c) Sửa `getSimpleList()`:

```typescript
async getSimpleList(query: UserQueryDto) {
  const sessionGroupId = getSessionGroupId();
  if (sessionGroupId) {
    const memberIds = await this.iamClient.getGroupMemberIds(
      String(sessionGroupId),
    );
    if (!memberIds.length) return { data: [] };
    return this.userRepo.findAllSimple({ ...query, userIds: memberIds });
  }
  return this.userRepo.findAllSimple(query);
}
```

**Flow khi group context:**

```
1. getSessionGroupId() → 5n (ví dụ groupId = 5)
2. iamClient.getGroupMemberIds("5")
   → Redis cache hit? → trả về [1n, 3n, 7n]
   → Cache miss? → GET /internal/groups/5/member-ids → cache → trả về
3. userRepo.findAll({ ...query, userIds: [1n, 3n, 7n] })
   → buildWhere(): { AND: [..., { id: { in: [1n, 3n, 7n] } }] }
   → Prisma query: WHERE id IN (1, 3, 7) AND ...other filters
4. Trả về danh sách user thuộc group
```

**Flow khi system context:**

```
1. getSessionGroupId() → null
2. Bỏ qua filter → userRepo.findAll(query) như cũ
```

---

### 4.4 `apps/auth-service/src/modules/user/user.module.ts` — SỬA

**Hiện tại:**

```typescript
@Module({
  imports: [
    EnumModule.register({ path: 'users/enums', enums: UserEnums }),
  ],
  controllers: [AdminUserController, ProfileController],
  providers: [UserAdminRepository, AdminUserService, ProfileService],
})
export class UserModule {}
```

**Vấn đề:** `AdminUserService` cần inject `IamClient`, nhưng `IamClient` được provide ở `CoreModule`. Cần đảm bảo `CoreModule` export `IamClient` để các module khác inject được.

**Kiểm tra:** Nếu `CoreModule` đã export `IamClient` → không cần sửa `UserModule` (vì `CoreModule` được import ở `AppModule` level).

**Nếu chưa export:** Sửa `CoreModule`:

```typescript
// apps/auth-service/src/core/core.module.ts
@Module({
  providers: [IamClient, ...],
  exports: [IamClient, ...],  // đảm bảo export
})
export class CoreModule {}
```

Hoặc nếu `IamClient` là `@Global()` provider thì không cần sửa gì thêm.

---

## Tổng kết file thay đổi

| # | Service | File | Loại | Mô tả thay đổi |
|---|---------|------|------|-----------------|
| 1 | shared | `session/session-context.ts` | Sửa | +2 getter: `groupId`, `isSystemContext` |
| 2 | shared | `session/group-filter.helper.ts` | Tạo mới | Function `getSessionGroupId()` |
| 3 | shared | `index.ts` | Sửa | +1 dòng export |
| 4 | config | — | — | Không cần thay đổi |
| 5 | iam | `group/repositories/group.repository.ts` | Sửa | +method `findMemberIds()` |
| 6 | iam | `internal/group-internal.controller.ts` | Tạo mới | Endpoint `GET /internal/groups/:id/member-ids` |
| 7 | iam | `internal/internal.module.ts` | Sửa | +import GroupModule, +controller |
| 8 | iam | `group/group.module.ts` | Sửa | +export GroupRepository (nếu chưa có) |
| 9 | auth | `clients/iam.client.ts` | Sửa | +`doGet()`, +`getGroupMemberIds()` với cache |
| 10 | auth | `user/repositories/user-admin.repository.ts` | Sửa | +`userIds` filter trong `buildWhere()` |
| 11 | auth | `user/admin/services/user.service.ts` | Sửa | +IamClient DI, sửa `getList()` + `getSimpleList()` |
| 12 | auth | `user/user.module.ts` hoặc `core/core.module.ts` | Sửa | Đảm bảo export `IamClient` |

**Tổng: 9-10 file** (3 shared + 0 config + 3-4 iam + 3-4 auth)

---

## Checklist kiểm tra

### Sau khi sửa shared:
- [ ] `npm run build:shared` — build thành công
- [ ] SessionContext có getter `groupId` và `isSystemContext`
- [ ] `getSessionGroupId()` được export từ `@package/common`

### Sau khi sửa iam-service:
- [ ] `GET /internal/groups/:id/member-ids` trả về `{ userIds: string[] }`
- [ ] Endpoint yêu cầu `x-internal-secret` header (InternalGuard)
- [ ] Group không tồn tại → trả `{ userIds: [] }` (không throw error)

### Sau khi sửa auth-service:
- [ ] `GET /admin/users` **không có** `x-group-id` header → trả tất cả user (system context)
- [ ] `GET /admin/users` **có** `x-group-id: 5` → chỉ trả user thuộc group 5
- [ ] `GET /admin/users/simple` — cùng behavior
- [ ] `x-group-id` header invalid (chữ, rỗng) → xử lý như system context (không crash)
- [ ] Redis cache hoạt động — request thứ 2 không gọi IAM
- [ ] IAM service unreachable → circuit breaker mở → trả lỗi (không treo request)

### Config service:
- [ ] Không có thay đổi nào
- [ ] `GET /user/menus` vẫn hoạt động bình thường với `x-group-id`
