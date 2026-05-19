# Đánh giá Post Service

> Đánh giá tại: 2026-05-19
> Reviewer: Claude Sonnet 4.6
> Phạm vi: `apps/post-service/src/` + `prisma/schema.prisma`

---

## Tổng quan

Post Service là một microservice NestJS quản lý bài viết, danh mục, tag và bình luận. Nhìn chung kiến trúc **rõ ràng, có tư duy bảo mật tốt**, nhiều vấn đề đã được xử lý cẩn thận (mass-assignment, DoS, race condition, distributed lock). Tuy nhiên có một số bug thực sự và điểm cần cải thiện.

**Điểm mạnh tổng thể:** 8/10
**Độ ưu tiên sửa:** 3 bug cần sửa ngay, 5 điểm cải thiện.

---

## Bugs Thực Sự

### 🔴 BUG 1 — `AdminPostService.update()` không gọi `transform()`

**File:** [post.service.ts:124](../apps/post-service/src/modules/post/admin/services/post.service.ts#L124)

```ts
// update() hiện tại
const updated = await this.postRepo.updateWithRelations(...);
await this.clearPostCaches(...);
return updated;   // ← trả thẳng, KHÔNG qua transform()
```

`updateWithRelations` trả về object có `categoryLinks: [{ category: {...} }]` và `tagLinks: [{ tag: {...} }]` (Prisma include format). Nhưng `getOne()` và `getList()` đều gọi `this.transform()` để convert thành `categories: [...]` và `tags: [...]`.

**Hệ quả:** Response của `PUT /admin/posts/:id` có format khác với `GET /admin/posts/:id`. Client sẽ không nhận được `categories` / `tags` sau khi update — nhận `categoryLinks` / `tagLinks` thay thế.

**Sửa:** Thêm `return this.transform(updated)` ở cuối `update()`.

---

### 🟡 BUG 2 — `UserCommentController.update()` không validate body

**File:** [comment.controller.ts:21](../apps/post-service/src/modules/comment/user/controllers/comment.controller.ts#L21)

```ts
@Put(':id')
async update(@Param('id') id: string, @Body() body: { content: string }) {
  // body.content không có DTO, không có @IsString(), không có @MaxLength()
}
```

Body nhận kiểu plain object `{ content: string }` — không đi qua `class-validator`. User có thể gửi:
- Content trống (`""`)
- Content dài hàng MB (DB `TEXT` không giới hạn)
- Content không phải string (`content: 123`)

**Sửa:** Tạo `UpdateCommentDto` với `@IsString() @MaxLength(10000) content: string` và dùng trong controller.

---

### 🟡 BUG 3 — Outbox comment notification không gửi khi dùng RabbitMQ

**File:** [comment.service.ts:23](../apps/post-service/src/modules/comment/user/services/comment.service.ts#L23)

```ts
const kafkaEnabled = !!this.config.get<boolean>('kafka.enabled');
// ...
const needsOutbox = kafkaEnabled && parent && String(parent.userId) !== String(userId);
```

Service check cứng `kafka.enabled`. Khi hệ thống cấu hình `EVENT_DRIVER=rabbitmq`, `kafkaEnabled = false` → outbox entry không bao giờ được tạo → notification "bạn có reply mới" không bao giờ được gửi dù RabbitMQ hoạt động bình thường.

**Sửa:** Đổi điều kiện thành `const eventEnabled = !!this.config.get('kafka.enabled') || !!this.config.get('rabbitmq.enabled')`.

---

## Vấn Đề Logic & Hiệu Năng

### 🟡 Cache detail post không tiết kiệm DB query

**File:** [post.service.ts:55–77](../apps/post-service/src/modules/post/public/services/post.service.ts#L55)

```ts
async getBySlug(slug: string, requesterKey?: string) {
  const post = await this.postRepo.findBySlug(slug, PUBLIC_POST_STATUSES); // ← LUÔN gọi DB
  if (!post) throw new NotFoundException(...);

  // view counting...

  return this.getOrSet(cacheKey, 120, async () => this.transform(post));
  //                                   ↑ factory chỉ chạy khi cache miss
}
```

`findBySlug` được gọi trên **mỗi request**, kể cả khi cache hit. Redis cache chỉ tiết kiệm `transform()` — một thao tác trivial. Với traffic cao, mỗi request vẫn đánh 1 DB query.

**Lý do thiết kế có thể chấp nhận được:** View counting cần post.id, và cần verify post vẫn còn public (tránh trả cached data cho post đã unpublish). Nhưng nếu muốn tối ưu thật sự, có thể lưu cả `{ id, status }` vào cache và chỉ query DB khi miss.

---

### 🟡 Slug cũ không bị xóa cache khi slug thay đổi

**File:** [post.service.ts:122](../apps/post-service/src/modules/post/admin/services/post.service.ts#L122)

```ts
await this.clearPostCaches(data.slug || (current as any).slug);
//                         ↑ xóa slug MỚI, không xóa slug CŨ
```

Khi slug thay đổi (đổi tên bài viết), cache `post:public:detail:{old_slug}` vẫn tồn tại 120 giây. Trong khoảng thời gian đó, request đến slug cũ sẽ trả về data từ cache mặc dù bài viết đã đổi sang slug mới.

**Sửa:** Nếu slug thay đổi (`data.slug !== current.slug`), clear cả cache của slug cũ trước khi clear slug mới.

---

### 🟡 `AdminCategoryService.update()` regenerate slug không cần thiết

**File:** [category.service.ts:83](../apps/post-service/src/modules/category/admin/services/category.service.ts#L83)

```ts
if (dto.name) {
  data.slug = await SlugHelper.uniqueSlug(dto.name, ...);  // luôn tạo slug mới nếu có name
}
```

So với `AdminPostService.update()` đã xử lý đúng:

```ts
const nameChanged = dto.name !== undefined && dto.name !== (current as any).name;
if (dto.slug || nameChanged) { ... }  // chỉ tạo slug khi cần
```

Category service tạo slug mới bất kể tên có thay đổi hay không — dẫn đến slug có thể thay đổi ngầm (thêm suffix `-1`, `-2`) khi admin gửi update mà không đổi tên.

---

## Dead Code

### Dead code trong Repository

**File:** [category.repository.ts:143](../apps/post-service/src/modules/category/repositories/category.repository.ts#L143)

`CategoryRepository.buildOrderBy()` được định nghĩa nhưng không bao giờ được gọi. `findMany()` hard-code `orderBy: { sortOrder: 'asc' }` thay vì dùng method này.

**File:** [comment.repository.ts:22](../apps/post-service/src/modules/comment/repositories/comment.repository.ts#L22)

`SORTABLE_FIELDS` trong `CommentRepository` được định nghĩa nhưng không được dùng ở đâu cả.

---

### Dead field trong Schema

**File:** [prisma/schema.prisma](../apps/post-service/prisma/schema.prisma)

`groupId` tồn tại trong model `Category`, `Tag`, và `Post` (cùng index `*_idx_group_id`) nhưng không được dùng ở bất kỳ filter, create, hay update nào trong toàn bộ codebase. Đây là remnant từ feature group-scope đã bị bỏ.

---

## Đánh Giá Từng Khía Cạnh

### Cấu trúc — ✅ Tốt

```
src/modules/<domain>/
  admin/    → CRUD admin (Permission)
  public/   → Read-only public (Public)
  user/     → Authenticated user actions
  repositories/
  enums/
```

Phân tách rõ ràng: controller chỉ nhận input → service xử lý logic → repository truy cập DB. Không có business logic trong controller, không có Prisma call trực tiếp trong service. Đúng pattern.

### Bảo mật — ✅ Tốt

| Cơ chế | Trạng thái |
|--------|-----------|
| ALLOWED_FIELDS whitelist chống mass-assignment | ✅ Áp dụng đủ: Post, Category, Tag, Comment |
| SORTABLE_FIELDS allowlist chống DoS sort | ✅ Post, Category |
| Search input capped 100 chars | ✅ |
| Slug validation regex | ✅ `^[a-z0-9](?:[a-z0-9-]{0,253}[a-z0-9])?$` |
| URL validation `IsUrl` | ✅ image, coverImage, videoUrl, audioUrl |
| BigInt ID parsing không throw 500 | ✅ `toPrimaryKey()` |
| Reply depth enforcement | ✅ depth ≤ 1 |
| Comment chỉ cho phép trên published post | ✅ `PUBLIC_POST_STATUSES` |
| Authenticated user không spoofing guest | ✅ Strip guestName/guestEmail trong UserCommentService |
| Cycle detection trong Category hierarchy | ✅ `assertNoCycle()` walk O(depth) |

**Điểm yếu bảo mật:** `UserCommentController.update` không validate body (Bug 2 ở trên).

### Hiệu năng — ✅ Tốt với một điểm cần lưu ý

| Cơ chế | Trạng thái |
|--------|-----------|
| Versioned cache invalidation (thay vì SCAN) | ✅ |
| Inflight deduplication (Map) | ✅ |
| HyperLogLog cho unique view count | ✅ bộ nhớ O(1) |
| Distributed lock cho ViewCronService | ✅ setnx + TTL |
| Atomic RENAME buffer trước khi flush | ✅ tránh lost-write race |
| Batch 20 upsert song song | ✅ |
| Composite index `[status, publishedAt DESC]` | ✅ |
| Composite index `[postId, createdAt]` cho comments | ✅ |
| Cap replies 50/request | ✅ |

**Điểm yếu:** Detail cache không tiết kiệm DB query (xem phần trên).

**Lưu ý ViewCronService:** Lock TTL 60s, cron chạy mỗi 5 phút. Nếu flush mất > 60s (cluster Redis slow), lock expire trong lúc đang flush → 2 pod có thể flush song song → double-count. Unlikely nhưng không phải impossible.

### Logic — ✅ Tốt với vài ngoại lệ

**Tốt:**
- Slug collision retry (P2002) trong create với giới hạn 2 lần
- `createWithRelations` / `updateWithRelations` đảm bảo atomicity post + stats + categories + tags
- `syncCategories` / `syncTags` delete-then-recreate trong transaction
- `assertNoCycle` ngăn circular parent trong Category
- Outbox pattern cho event publishing (reliable delivery)

**Vấn đề:** Transform không được gọi trong `update()` (Bug 1), Kafka-only check trong comment outbox (Bug 3).

### Test Coverage — ⚠️ Không có file test

Không tìm thấy file `*.spec.ts` nào trong `apps/post-service/tests/`. Theo quy tắc trong CLAUDE.md: **"Code xong PHAI viet unit test"**.

---

## Tóm tắt ưu tiên

| # | Loại | Vấn đề | Ưu tiên |
|---|------|---------|---------|
| 1 | Bug | `update()` không gọi `transform()` → response sai format | 🔴 Cao |
| 2 | Bug | Comment update không validate body → no length limit | 🟡 Trung bình |
| 3 | Bug | Outbox không tạo khi dùng RabbitMQ driver | 🟡 Trung bình |
| 4 | Logic | Slug cũ không xóa cache khi slug thay đổi | 🟡 Trung bình |
| 5 | Logic | Category slug regenerate kể cả khi name không đổi | 🟡 Thấp |
| 6 | Perf | Detail cache không save DB query | 🟢 Thấp |
| 7 | Code | Dead code: `buildOrderBy`, `SORTABLE_FIELDS` trong comment repo | 🟢 Thấp |
| 8 | Schema | `groupId` dead field trong Category/Tag/Post | 🟢 Thấp |
| 9 | Test | Không có unit test nào | 🔴 Cao (theo rule) |
