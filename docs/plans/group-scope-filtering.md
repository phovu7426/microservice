# Kế hoạch: Group Scope Filtering

## Bối cảnh

Hệ thống hỗ trợ 2 loại context:

- **System context**: Không có `x-group-id` header (hoặc rỗng) → xem/lọc tất cả dữ liệu. Vẫn có thể truyền `groupId` như một query param tuỳ chọn để thu hẹp kết quả.
- **Group context**: Có `x-group-id` header → chỉ xem dữ liệu thuộc group đó, không thể bỏ qua.

Quy tắc này hiện phải viết tay ở mỗi service. Mục tiêu là tập trung logic vào một chỗ và áp dụng nhất quán.

---

## Giải pháp

### Nguyên tắc thiết kế

- **Không thay đổi inheritance** — các service hiện tại không kế thừa `BaseService`, chúng inject repository trực tiếp và tự implement `getList()`, `buildFilter()`. Việc đổi sang kế thừa `GroupAwareBaseService` sẽ đòi hỏi refactor toàn bộ, rủi ro cao.
- **Thêm ít, sửa ít** — mỗi service chỉ cần thêm 2-3 dòng vào `buildFilter()` hoặc nơi xây dựng filter, mỗi repository thêm 1 dòng vào `buildWhere()`.
- **Explicit hơn implicit** — dùng helper function rõ ràng thay vì magic qua base class.

### Kiến trúc

```
SessionContext        — đọc groupId từ header, tính isSystemContext
getSessionGroupId()   — helper function lấy groupId bắt buộc (group context) hoặc null (system context)
Repository.buildWhere — thêm 1 dòng filter groupId
Service.buildFilter   — thêm 2 dòng gọi helper + gán filter
```

### Flow xử lý

```
Request vào → SessionContextMiddleware lưu context vào AsyncLocalStorage
    ↓
Service.buildFilter() hoặc getList()
    ↓
Gọi getSessionGroupId():
  - Group context → trả về groupId (bắt buộc)
  - System context → trả về null → dùng query.groupId nếu có (tuỳ chọn)
    ↓
Truyền groupId vào filter → Repository.buildWhere() → Prisma WHERE
```

---

## Phân loại bảng

### Case A — groupId trực tiếp trên bảng

Xử lý đơn giản: thêm `groupId` vào filter interface + `buildWhere()` + `buildFilter()`.

| Service | Bảng | Field | Đã có trong DB |
|---------|------|-------|:--------------:|
| comic-service | Comic | `groupId BigInt?` | ✅ |
| comic-service | Chapter | `groupId BigInt?` | ✅ |
| comic-service | Category | `groupId BigInt?` | ✅ |
| post-service | Post | `groupId BigInt?` | ✅ |
| post-service | Category | `groupId BigInt?` | ✅ |
| post-service | Tag | `groupId BigInt?` | ✅ |

### Case B — Bảng không có groupId, scope qua parent entity

Comment và Review **không có** `groupId` trực tiếp, mà luôn scope qua parent entity (Comic/Post):

| Service | Bảng | Parent | Scope cách |
|---------|------|--------|-----------|
| comic-service | Comment | Comic (comicId) | Implicit — Comic đã bị filter theo group |
| comic-service | Review | Comic (comicId) | Implicit — Comic đã bị filter theo group |
| post-service | Comment | Post (postId) | Implicit — Post đã bị filter theo group |

Khi Comic/Post đã bị filter theo groupId, các public API comment/review yêu cầu `comicId`/`postId` → nếu entity cha không thuộc group, user không thể lấy được ID hợp lệ để query. **Không cần thêm groupId vào Comment/Review.**

### Case C — User/Account (cross-service qua junction table)

`auth-service.User` **không có** `groupId` trực tiếp. Quan hệ:

```
auth-service.users ←—(app-level userId)—→ iam-service.user_groups.groupId
```

Khi group context → gọi IAM internal API lấy danh sách userId của group → filter User theo `id IN [...]`. Cache kết quả trong Redis + invalidate qua Kafka event.

---

## Danh sách file thay đổi

### 1. Shared Common — 2 file sửa, 1 file tạo mới

#### `shared/common/src/session/session-context.ts` *(sửa)*

Thêm `groupId` getter và `isSystemContext`:

```typescript
get groupId(): bigint | null {
  const raw = this.req.headers['x-group-id'] as string | undefined;
  if (!raw) return null;
  try { return BigInt(raw); } catch { return null; }
}

get isSystemContext(): boolean {
  return this.groupId === null;
}
```

#### `shared/common/src/session/group-filter.helper.ts` *(tạo mới)*

Helper function trả về groupId bắt buộc trong group context, null trong system context:

```typescript
import { session } from './session-context.storage';

/**
 * Trả về groupId từ session nếu đang ở group context (bắt buộc filter).
 * Trả về null nếu system context (không bắt buộc).
 */
export function getSessionGroupId(): bigint | null {
  const ctx = session();
  if (!ctx || ctx.isSystemContext) return null;
  return ctx.groupId;
}
```

#### `shared/common/src/index.ts` *(sửa)*

Thêm export:

```typescript
export { getSessionGroupId } from './session/group-filter.helper';
```

---

### 2. comic-service — 6 file (3 repo + 3 admin service)

Pattern áp dụng cho cả 3 module: comic, chapter, category.

#### Repository: thêm `groupId` vào filter interface + `buildWhere()`

**`apps/comic-service/src/modules/comic/repositories/comic.repository.ts`**

```typescript
// Thêm vào ComicFilter interface:
export interface ComicFilter {
  // ... existing fields ...
  groupId?: bigint;
}

// Thêm vào buildWhere():
if (filter.groupId) where.groupId = filter.groupId;
```

**`apps/comic-service/src/modules/chapter/repositories/chapter.repository.ts`**

```typescript
// Thêm vào ChapterFilter:
groupId?: bigint;

// Thêm vào buildWhere():
if (filter.groupId) where.groupId = filter.groupId;
```

**`apps/comic-service/src/modules/category/repositories/category.repository.ts`**

```typescript
// Thêm vào CategoryFilter:
groupId?: bigint;

// Thêm vào buildWhere():
if (filter.groupId) where.groupId = filter.groupId;
```

#### Admin Service: thêm group filter vào `buildFilter()` hoặc nơi xây dựng filter

**`apps/comic-service/src/modules/comic/admin/services/comic.service.ts`**

```typescript
import { getSessionGroupId } from '@package/common';

// Trong buildFilter():
private buildFilter(query: any): ComicFilter {
  const filter: ComicFilter = {};
  // ... existing filter logic giữ nguyên ...

  // Group scope — thêm 2 dòng
  const sessionGroupId = getSessionGroupId();
  filter.groupId = sessionGroupId ?? query.groupId ?? undefined;

  return filter;
}
```

**`apps/comic-service/src/modules/chapter/admin/services/chapter.service.ts`**
— Cùng pattern: thêm `getSessionGroupId()` vào nơi xây dựng filter.

**`apps/comic-service/src/modules/category/admin/services/category.service.ts`**
— Cùng pattern.

---

### 3. comic-service public — 3 file

Public service cũng cần group filter để đảm bảo user trong group context chỉ thấy dữ liệu thuộc group.

**`apps/comic-service/src/modules/comic/public/services/comic.service.ts`**

```typescript
import { getSessionGroupId } from '@package/common';

// Trong getList() — nơi xây dựng filter inline:
const filter: ComicFilter = {
  status: ComicStatus.PUBLISHED,
  // ... existing ...
};
const sessionGroupId = getSessionGroupId();
filter.groupId = sessionGroupId ?? query.groupId ?? undefined;
```

**`apps/comic-service/src/modules/chapter/public/services/chapter.service.ts`**
— Comment/Review scope qua parent Comic → không cần thêm groupId trực tiếp.

**`apps/comic-service/src/modules/category/public/services/category.service.ts`**
— Thêm group filter nếu có sử dụng filter (kiểm tra lại, nếu chỉ dùng `findAll()` cache thì cần truyền groupId làm cache key).

---

### 4. post-service — 6 file (3 repo + 3 admin service)

Pattern y chang comic-service.

#### Repository

**`apps/post-service/src/modules/post/repositories/post.repository.ts`**

```typescript
// Thêm vào PostFilter:
groupId?: bigint;

// Thêm vào buildWhere():
if (filter.groupId) where.groupId = filter.groupId;
```

**`apps/post-service/src/modules/category/repositories/category.repository.ts`**

```typescript
// Thêm vào CategoryFilter:
groupId?: bigint;

// Thêm vào buildWhere():
if (filter.groupId) where.groupId = filter.groupId;
```

**`apps/post-service/src/modules/tag/repositories/tag.repository.ts`**

```typescript
// Thêm vào TagFilter:
groupId?: bigint;

// Thêm vào buildWhere():
if (filter.groupId) where.groupId = filter.groupId;
```

#### Admin Service

**`apps/post-service/src/modules/post/admin/services/post.service.ts`**

```typescript
import { getSessionGroupId } from '@package/common';

// Trong buildFilter():
const sessionGroupId = getSessionGroupId();
filter.groupId = sessionGroupId ?? query.groupId ?? undefined;
```

**`apps/post-service/src/modules/category/admin/services/category.service.ts`**
— Cùng pattern.

**`apps/post-service/src/modules/tag/admin/services/tag.service.ts`**
— Cùng pattern.

---

### 5. post-service public — 2 file

**`apps/post-service/src/modules/post/public/services/post.service.ts`**
— Thêm group filter vào nơi xây dựng filter inline.

**`apps/post-service/src/modules/category/public/services/category.service.ts`**
— Kiểm tra: nếu chỉ gọi `findRootActiveTree()` cache, cần truyền groupId làm cache key.

---

### 6. iam-service — 2-3 file (endpoint mới)

Thêm internal endpoint lấy member IDs cho Case C.

#### `apps/iam-service/src/internal/` — thêm endpoint *(tạo mới hoặc mở rộng)*

Endpoint: `GET /internal/groups/:id/member-ids`

```typescript
@Internal()
@UseGuards(InternalGuard)
@Get('groups/:id/member-ids')
async getMemberIds(@Param('id', ParseBigIntPipe) id: bigint) {
  const userIds = await this.groupRepo.findMemberIds(id);
  return ResponseUtil.success({ userIds: userIds.map(String) });
}
```

#### `apps/iam-service/src/modules/group/repositories/group.repository.ts` *(sửa)*

Thêm method:

```typescript
async findMemberIds(groupId: bigint): Promise<bigint[]> {
  const records = await this.prisma.userGroup.findMany({
    where: { groupId },
    select: { userId: true },
  });
  return records.map(r => r.userId);
}
```

---

### 7. auth-service — 3 file (Case C)

#### `apps/auth-service/src/clients/iam.client.ts` *(sửa)*

Thêm method với Redis cache + Kafka invalidation:

```typescript
private static readonly GROUP_MEMBERS_TTL_S = 120; // 2 phút

async getGroupMemberIds(groupId: string): Promise<bigint[]> {
  const cacheKey = `group:members:${groupId}`;

  // Cache first
  try {
    const cached = await this.redis.get(cacheKey);
    if (cached) return (JSON.parse(cached) as string[]).map(BigInt);
  } catch { /* Redis unavailable */ }

  // Call IAM
  const data = await this.doGet(
    `${this.baseUrl}/internal/groups/${groupId}/member-ids`,
  );
  const userIds: string[] = data?.userIds ?? [];

  // Cache result
  try {
    await this.redis.set(cacheKey, JSON.stringify(userIds), IamClient.GROUP_MEMBERS_TTL_S);
  } catch { /* not critical */ }

  return userIds.map(BigInt);
}

// Thêm doGet helper (tương tự doPost hiện có)
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

#### `apps/auth-service/src/modules/user/repositories/user-admin.repository.ts` *(sửa)*

Thêm `userIds` vào `buildWhere`:

```typescript
// Trong buildWhere():
if (query.userIds?.length) {
  andConditions.push({ id: { in: query.userIds } });
}
```

#### `apps/auth-service/src/modules/user/admin/services/user.service.ts` *(sửa)*

```typescript
import { getSessionGroupId } from '@package/common';

async getList(query: UserQueryDto) {
  const sessionGroupId = getSessionGroupId();
  if (sessionGroupId) {
    const memberIds = await this.iamClient.getGroupMemberIds(String(sessionGroupId));
    if (!memberIds.length) {
      return { data: [], meta: { page: 1, limit: 20, total: 0, totalPages: 0 } };
    }
    return this.userRepo.findAll({ ...query, userIds: memberIds });
  }
  return this.userRepo.findAll(query);
}
```

---

### 8. Cache invalidation cho group members (Kafka)

Khi iam-service thêm/xoá member khỏi group, cần invalidate cache `group:members:{groupId}` ở auth-service.

#### Cách 1: Kafka event (khuyến nghị)

**iam-service** — publish event khi `addMember` / `removeMember`:

```typescript
// Trong GroupService.addMember() và removeMember():
await this.kafkaProducer.emit('group.member.changed', {
  groupId: String(groupId),
  userId: String(userId),
});
```

**auth-service** — consumer xoá cache:

```typescript
@MessagePattern('group.member.changed')
async handleGroupMemberChanged(data: { groupId: string }) {
  await this.redis.del(`group:members:${data.groupId}`);
}
```

#### Cách 2: TTL ngắn (fallback)

Cache TTL 120 giây đã là fallback tự nhiên. Nếu chưa cần Kafka ngay, có thể dùng TTL trước, bổ sung Kafka sau.

---

## Tổng kết

| Nhóm | Số file | Loại thay đổi |
|------|---------|---------------|
| Shared common | 3 | 1 tạo mới (`group-filter.helper.ts`), 2 sửa |
| comic-service repos | 3 | Thêm `groupId` vào filter + buildWhere |
| comic-service admin services | 3 | Thêm 2-3 dòng vào buildFilter |
| comic-service public services | 1-2 | Thêm group filter vào getList |
| post-service repos | 3 | Thêm `groupId` vào filter + buildWhere |
| post-service admin services | 3 | Thêm 2-3 dòng vào buildFilter |
| post-service public services | 1-2 | Thêm group filter vào getList |
| iam-service | 2-3 | Endpoint mới + repo method |
| auth-service | 3 | Client + repo + service |
| **Tổng** | **~22-24** | |

### So sánh với kế hoạch cũ

| Tiêu chí | Kế hoạch cũ | Kế hoạch mới |
|----------|-------------|-------------|
| Thay đổi inheritance | Có (tạo GroupAwareBaseService, đổi base class) | Không (giữ nguyên cấu trúc) |
| Rủi ro regression | Cao | Thấp |
| Độ phức tạp mỗi service | Trung bình (hiểu 3 tầng kế thừa) | Thấp (2-3 dòng explicit) |
| Public API | Chưa cover | Có cover |
| Comment/Review | Chưa phân tích | Đã phân tích — scope qua parent, không cần thêm |
| Case C caching | Không có | Redis cache + Kafka invalidation |
| Unit test | Mock SessionContext + BaseService chain | Mock `getSessionGroupId()` — 1 function |

**Không cần migration DB** — tất cả field `groupId` đã tồn tại trong schema.

**Không tác động:**
- marketing-service, config-service, notification-service, introduction-service, storage-service — không có group scoping
- JWT / auth flow — không thay đổi

---

## Thứ tự thực hiện

1. **SessionContext** — thêm `groupId`, `isSystemContext` getter
2. **`group-filter.helper.ts`** — tạo mới helper function
3. **Export** trong `index.ts`
4. **Build shared**: `npm run build:shared`
5. **comic-service** — repositories → admin services → public services
6. **post-service** — repositories → admin services → public services
7. **iam-service** — internal endpoint mới + repo method
8. **auth-service** — IAM client (+ `doGet` + cache) → repository → service
9. **Kafka event** (tuỳ chọn) — iam-service publish + auth-service consumer
