# Post Service — Tài liệu API cho Frontend

> Base URL (qua Nginx): `/api/posts`
> Service port trực tiếp: `3008`
> Tất cả response đều được bọc bởi `TransformInterceptor`

---

## Mục lục

1. [Cấu trúc Response chung](#1-cấu-trúc-response-chung)
2. [Xác thực & Phân quyền](#2-xác-thực--phân-quyền)
3. [Bài viết — Public](#3-bài-viết--public)
4. [Bài viết — Admin](#4-bài-viết--admin)
5. [Danh mục — Public](#5-danh-mục--public)
6. [Danh mục — Admin](#6-danh-mục--admin)
7. [Tag — Public](#7-tag--public)
8. [Tag — Admin](#8-tag--admin)
9. [Bình luận — Public](#9-bình-luận--public)
10. [Bình luận — User (đã đăng nhập)](#10-bình-luận--user-đã-đăng-nhập)
11. [Bình luận — Admin](#11-bình-luận--admin)
12. [Enum Reference](#12-enum-reference)
13. [Lỗi thường gặp](#13-lỗi-thường-gặp)

---

## 1. Cấu trúc Response chung

Mọi response đều có dạng:

```json
{
  "success": true,
  "data": { ... },
  "meta": { ... },
  "timestamp": "2026-05-19T10:00:00.000Z"
}
```

**Response danh sách (có phân trang):**
```json
{
  "success": true,
  "data": [ ... ],
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 100,
    "totalPages": 10
  },
  "timestamp": "2026-05-19T10:00:00.000Z"
}
```

> **Lưu ý:** ID dạng BigInt được serialize thành **Number** trong JSON (ví dụ: `123` thay vì `"123"`). Tuy nhiên, do số nguyên JavaScript có giới hạn an toàn là 2^53 - 1, nên nếu cần xử lý ID lớn hãy dùng string.

**Response lỗi:**
```json
{
  "success": false,
  "error": {
    "code": 400,
    "message": "Slug đã được sử dụng"
  },
  "timestamp": "2026-05-19T10:00:00.000Z"
}
```

---

## 2. Xác thực & Phân quyền

| Loại route | Mô tả | Header cần thiết |
|------------|-------|-----------------|
| `public/*` | Không cần đăng nhập | Không bắt buộc |
| `user/*` | Cần đăng nhập (user thường) | `Authorization: Bearer <token>` |
| `admin/*` | Cần quyền `post.manage` | `Authorization: Bearer <token>` |

Token là JWT lấy từ **auth-service**. Gửi trong header:
```
Authorization: Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## 3. Bài viết — Public

### 3.1 Lấy danh sách bài viết

```
GET /api/posts/public/posts
```

**Query params:**

| Param | Kiểu | Mô tả |
|-------|------|-------|
| `page` | number | Trang (default: 1) |
| `limit` | number | Số item mỗi trang (default: 10, max: 100) |
| `search` | string | Tìm kiếm theo tên hoặc slug |
| `sort` | string | Sắp xếp: `name:asc`, `publishedAt:desc`, `viewCount:desc`, `createdAt:desc` (default: `publishedAt:desc`) |
| `postType` | string | Lọc theo loại: `text` \| `video` \| `image` \| `audio` |
| `isFeatured` | boolean | Lọc bài nổi bật: `true` \| `false` |
| `isPinned` | boolean | Lọc bài ghim: `true` \| `false` |
| `categoryId` | number | Lọc theo ID danh mục (alias: `postCategoryId`) |
| `tagId` | number | Lọc theo ID tag (alias: `postTagId`) |
| `skipCount` | boolean | Bỏ qua đếm tổng để tăng tốc (default: false) |

> Chỉ trả về bài có `status = published`. Không lọc được theo status.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "slug": "bai-viet-dau-tien",
      "name": "Bài viết đầu tiên",
      "excerpt": "Tóm tắt ngắn về bài viết...",
      "image": "https://cdn.example.com/thumb.jpg",
      "coverImage": "https://cdn.example.com/cover.jpg",
      "status": "published",
      "postType": "text",
      "videoUrl": null,
      "audioUrl": null,
      "isFeatured": true,
      "isPinned": false,
      "publishedAt": "2026-05-01T08:00:00.000Z",
      "seoTitle": "SEO Title",
      "seoDescription": "SEO Description",
      "seoKeywords": "keyword1, keyword2",
      "createdAt": "2026-05-01T07:00:00.000Z",
      "updatedAt": "2026-05-01T09:00:00.000Z",
      "stats": {
        "postId": 1,
        "viewCount": 1250,
        "updatedAt": "2026-05-19T10:00:00.000Z"
      },
      "categories": [
        { "id": 3, "name": "Công nghệ", "slug": "cong-nghe" }
      ],
      "tags": [
        { "id": 7, "name": "NestJS", "slug": "nestjs" }
      ]
    }
  ],
  "meta": { "page": 1, "limit": 10, "total": 42, "totalPages": 5 }
}
```

---

### 3.2 Lấy chi tiết bài viết theo slug

```
GET /api/posts/public/posts/:slug
```

> Mỗi lần gọi endpoint này sẽ tự động đếm 1 lượt xem (dedup theo user/IP trong ngày bằng HyperLogLog).

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "slug": "bai-viet-dau-tien",
    "name": "Bài viết đầu tiên",
    "excerpt": "Tóm tắt ngắn...",
    "content": "<p>Nội dung HTML đầy đủ của bài viết...</p>",
    "image": "https://cdn.example.com/thumb.jpg",
    "coverImage": "https://cdn.example.com/cover.jpg",
    "status": "published",
    "postType": "text",
    "videoUrl": null,
    "audioUrl": null,
    "isFeatured": true,
    "isPinned": false,
    "publishedAt": "2026-05-01T08:00:00.000Z",
    "seoTitle": "SEO Title",
    "seoDescription": "SEO Description",
    "seoKeywords": "keyword1, keyword2",
    "createdAt": "2026-05-01T07:00:00.000Z",
    "updatedAt": "2026-05-01T09:00:00.000Z",
    "stats": {
      "postId": 1,
      "viewCount": 1251,
      "updatedAt": "2026-05-19T10:00:00.000Z"
    },
    "categories": [
      { "id": 3, "name": "Công nghệ", "slug": "cong-nghe" }
    ],
    "tags": [
      { "id": 7, "name": "NestJS", "slug": "nestjs" }
    ]
  }
}
```

> **Lưu ý `content`:** Danh sách (3.1) **không có** trường `content` để giảm payload. Chỉ detail (3.2) mới có.

**Lỗi:**
- `404` — Bài viết không tồn tại hoặc chưa publish

---

## 4. Bài viết — Admin

> Tất cả route cần header `Authorization: Bearer <token>` và quyền `post.manage`.

### 4.1 Lấy danh sách bài viết (admin)

```
GET /api/posts/admin/posts
```

**Query params** (ngoài các param phân trang chung):

| Param | Kiểu | Mô tả |
|-------|------|-------|
| `page` | number | Trang (default: 1) |
| `limit` | number | Số item mỗi trang |
| `search` | string | Tìm kiếm theo tên, slug |
| `status` | string | `draft` \| `scheduled` \| `published` \| `archived` |
| `postType` | string | `text` \| `video` \| `image` \| `audio` |
| `isFeatured` | boolean | `true` \| `false` |
| `isPinned` | boolean | `true` \| `false` |
| `categoryId` | number | ID danh mục |
| `tagId` | number | ID tag |
| `skipCount` | boolean | Bỏ qua count (tăng tốc) |

**Response:** Tương tự public nhưng có thêm `content`, `createdUserId`, `updatedUserId`.

---

### 4.2 Lấy danh sách rút gọn (dùng cho dropdown)

```
GET /api/posts/admin/posts/simple
```

Trả về danh sách tối giản, dùng cho select/autocomplete, tối đa 200 items.

**Response:**
```json
{
  "success": true,
  "data": [
    { "id": 1, "name": "Bài viết đầu tiên", "slug": "bai-viet-dau-tien", "status": "published" },
    { "id": 2, "name": "Bài viết thứ hai", "slug": "bai-viet-thu-hai", "status": "draft" }
  ]
}
```

---

### 4.3 Lấy chi tiết bài viết (admin)

```
GET /api/posts/admin/posts/:id
```

**Response:** Đầy đủ tất cả trường, kể cả `categoryIds`, `tagIds`.

---

### 4.4 Tạo bài viết

```
POST /api/posts/admin/posts
Content-Type: application/json
```

**Request body:**

| Field | Kiểu | Bắt buộc | Mô tả |
|-------|------|----------|-------|
| `name` | string | ✅ | Tên bài viết, tối đa 255 ký tự |
| `slug` | string | ❌ | Tự sinh nếu bỏ trống. Format: `[a-z0-9-]`, tối đa 255 ký tự |
| `excerpt` | string | ❌ | Tóm tắt, tối đa 2000 ký tự |
| `content` | string | ❌ | Nội dung HTML, tối đa 200.000 ký tự (≈200KB) |
| `image` | string (URL) | ❌ | URL ảnh thumbnail, phải là `http://` hoặc `https://` |
| `coverImage` | string (URL) | ❌ | URL ảnh bìa |
| `status` | string | ❌ | `draft` (default) \| `scheduled` \| `published` \| `archived` |
| `postType` | string | ❌ | `text` (default) \| `video` \| `image` \| `audio` |
| `videoUrl` | string (URL) | ❌ | URL video (khi `postType = video`) |
| `audioUrl` | string (URL) | ❌ | URL audio (khi `postType = audio`) |
| `isFeatured` | boolean | ❌ | Bài nổi bật (default: `false`) |
| `isPinned` | boolean | ❌ | Bài ghim đầu (default: `false`) |
| `publishedAt` | string (ISO 8601) | ❌ | Ngày xuất bản. Ví dụ: `"2026-06-01T08:00:00.000Z"` |
| `seoTitle` | string | ❌ | Tiêu đề SEO, tối đa 255 ký tự |
| `seoDescription` | string | ❌ | Mô tả SEO, tối đa 2000 ký tự |
| `seoKeywords` | string | ❌ | Từ khóa SEO, tối đa 500 ký tự |
| `categoryIds` | number[] | ❌ | Mảng ID danh mục, tối đa 50 phần tử, không trùng |
| `tagIds` | number[] | ❌ | Mảng ID tag, tối đa 50 phần tử, không trùng |

**Ví dụ request:**
```json
{
  "name": "Giới thiệu NestJS",
  "excerpt": "Bài viết giới thiệu về NestJS framework",
  "content": "<h2>NestJS là gì?</h2><p>NestJS là một framework...</p>",
  "image": "https://cdn.example.com/nestjs-thumb.jpg",
  "status": "published",
  "postType": "text",
  "isFeatured": true,
  "publishedAt": "2026-05-19T08:00:00.000Z",
  "categoryIds": [1, 3],
  "tagIds": [7, 12]
}
```

**Response:** Chi tiết bài viết vừa tạo (giống 4.3).

**Lỗi:**
- `400` — Slug đã được sử dụng
- `400` — Dữ liệu không hợp lệ (URL sai format, content quá dài...)

---

### 4.5 Cập nhật bài viết

```
PUT /api/posts/admin/posts/:id
Content-Type: application/json
```

Body giống `POST` nhưng tất cả field đều optional. Chỉ gửi những field cần thay đổi.

> **Lưu ý `slug`:** Slug chỉ tự động tạo lại khi `name` thực sự thay đổi. Nếu gửi `name` giống giá trị hiện tại, slug giữ nguyên.

> **Lưu ý `categoryIds` / `tagIds`:** Nếu truyền vào, danh sách cũ bị **thay thế hoàn toàn**. Để xóa tất cả, truyền `[]`.

**Response:** Chi tiết bài viết sau khi cập nhật.

**Lỗi:**
- `404` — Không tìm thấy bài viết
- `400` — Slug mới đã được dùng

---

### 4.6 Xóa bài viết

```
DELETE /api/posts/admin/posts/:id
```

**Response:**
```json
{ "success": true, "data": { "success": true } }
```

**Lỗi:**
- `404` — Không tìm thấy bài viết

---

## 5. Danh mục — Public

### 5.1 Lấy cây danh mục

```
GET /api/posts/public/post-categories
```

Trả về toàn bộ cây danh mục có `status = active`, bao gồm danh mục con cấp 1.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "Công nghệ",
      "slug": "cong-nghe",
      "description": "Các bài viết về công nghệ",
      "parentId": null,
      "sortOrder": 0,
      "seoTitle": "Công nghệ - Blog",
      "seoDescription": "Tổng hợp bài viết công nghệ",
      "seoKeywords": "công nghệ, IT",
      "children": [
        {
          "id": 3,
          "name": "Backend",
          "slug": "backend",
          "description": "Backend development",
          "sortOrder": 1,
          "seoTitle": null,
          "seoDescription": null,
          "seoKeywords": null
        }
      ]
    }
  ]
}
```

> Chỉ trả về danh mục `active`. Children chỉ có **1 cấp** (không đệ quy sâu hơn).

---

## 6. Danh mục — Admin

### 6.1 Lấy danh sách danh mục (phân trang)

```
GET /api/posts/admin/post-categories
```

**Query params:**

| Param | Kiểu | Mô tả |
|-------|------|-------|
| `page` | number | Trang |
| `limit` | number | Số item/trang |
| `search` | string | Tìm theo tên/slug |
| `parentId` | number \| `"null"` | Lọc theo parent (`"null"` = root categories) |
| `status` | string | `active` \| `inactive` |
| `skipCount` | boolean | Bỏ qua count |

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "Công nghệ",
      "slug": "cong-nghe",
      "description": "Bài viết công nghệ",
      "parentId": null,
      "status": "active",
      "sortOrder": 0,
      "seoTitle": null,
      "seoDescription": null,
      "seoKeywords": null,
      "createdUserId": 1,
      "updatedUserId": 1,
      "createdAt": "2026-01-01T00:00:00.000Z",
      "updatedAt": "2026-05-01T00:00:00.000Z",
      "children": [ ... ]
    }
  ],
  "meta": { "page": 1, "limit": 10, "total": 5, "totalPages": 1 }
}
```

---

### 6.2 Lấy chi tiết danh mục

```
GET /api/posts/admin/post-categories/:id
```

---

### 6.3 Tạo danh mục

```
POST /api/posts/admin/post-categories
Content-Type: application/json
```

| Field | Kiểu | Bắt buộc | Mô tả |
|-------|------|----------|-------|
| `name` | string | ✅ | Tên danh mục, tối đa 255 ký tự |
| `description` | string | ❌ | Mô tả |
| `parentId` | number | ❌ | ID danh mục cha (để tạo cây). Phải tồn tại. |
| `status` | string | ❌ | `active` (default) \| `inactive` |
| `sortOrder` | number | ❌ | Thứ tự hiển thị (default: 0, số nhỏ lên trên) |
| `seoTitle` | string | ❌ | Tối đa 255 ký tự |
| `seoDescription` | string | ❌ | Mô tả SEO |
| `seoKeywords` | string | ❌ | Từ khóa SEO, tối đa 500 ký tự |

**Lỗi:**
- `400` — `parentId` không tồn tại

---

### 6.4 Cập nhật danh mục

```
PUT /api/posts/admin/post-categories/:id
```

Body giống POST, tất cả optional.

**Lỗi:**
- `404` — Không tìm thấy
- `400` — Phát hiện chu kỳ (cycle) trong cây: ví dụ A → B → A

---

### 6.5 Xóa danh mục

```
DELETE /api/posts/admin/post-categories/:id
```

> **Lưu ý:** Khi xóa danh mục cha, các danh mục con sẽ trở thành root (`parentId = null`).

---

## 7. Tag — Public

### 7.1 Lấy tất cả tag

```
GET /api/posts/public/post-tags
```

Trả về tất cả tag có `status = active`. Không phân trang.

**Response:**
```json
{
  "success": true,
  "data": [
    { "id": 7, "name": "NestJS", "slug": "nestjs", "description": "..." },
    { "id": 8, "name": "TypeScript", "slug": "typescript", "description": null }
  ]
}
```

---

## 8. Tag — Admin

### 8.1 Lấy danh sách tag (phân trang)

```
GET /api/posts/admin/post-tags
```

**Query params:** `page`, `limit`, `search`, `status` (`active` | `inactive`), `skipCount`

---

### 8.2 Lấy chi tiết tag

```
GET /api/posts/admin/post-tags/:id
```

---

### 8.3 Tạo tag

```
POST /api/posts/admin/post-tags
```

| Field | Kiểu | Bắt buộc | Mô tả |
|-------|------|----------|-------|
| `name` | string | ✅ | Tên tag, tối đa 255 ký tự |
| `description` | string | ❌ | Mô tả |
| `status` | string | ❌ | `active` (default) \| `inactive` |

---

### 8.4 Cập nhật tag

```
PUT /api/posts/admin/post-tags/:id
```

---

### 8.5 Xóa tag

```
DELETE /api/posts/admin/post-tags/:id
```

---

## 9. Bình luận — Public

### 9.1 Lấy danh sách bình luận

```
GET /api/posts/public/post-comments
```

**Query params:**

| Param | Kiểu | Bắt buộc | Mô tả |
|-------|------|----------|-------|
| `postId` | number | ✅ | ID bài viết cần lấy bình luận |
| `page` | number | ❌ | Trang (default: 1) |
| `limit` | number | ❌ | Số item/trang (default: 10, tối đa 50) |

> Chỉ trả về comment có `status = visible`. Mỗi comment root kèm tối đa **50 replies** đầu tiên.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 100,
      "userId": 10,
      "postId": 1,
      "parentId": null,
      "content": "Bài viết rất hay!",
      "status": "visible",
      "createdAt": "2026-05-10T14:30:00.000Z",
      "updatedAt": "2026-05-10T14:30:00.000Z",
      "replies": [
        {
          "id": 101,
          "userId": 5,
          "postId": 1,
          "parentId": 100,
          "content": "Tôi cũng đồng ý!",
          "status": "visible",
          "createdAt": "2026-05-10T15:00:00.000Z",
          "updatedAt": "2026-05-10T15:00:00.000Z"
        }
      ]
    }
  ],
  "meta": { "page": 1, "limit": 10, "total": 30, "totalPages": 3 }
}
```

> **Cấu trúc comment lồng nhau:** Hệ thống chỉ hỗ trợ **1 cấp reply** (comment → reply). Không thể reply vào reply.

---

## 10. Bình luận — User (đã đăng nhập)

> Cần header `Authorization: Bearer <token>`.

### 10.1 Đăng bình luận

```
POST /api/posts/user/post-comments
Content-Type: application/json
```

| Field | Kiểu | Bắt buộc | Mô tả |
|-------|------|----------|-------|
| `postId` | number | ✅ | ID bài viết |
| `content` | string | ✅ | Nội dung, 1–5000 ký tự |
| `parentId` | number | ❌ | ID comment cha (nếu muốn reply) |

**Ví dụ — bình luận mới:**
```json
{
  "postId": 1,
  "content": "Bài viết rất hữu ích, cảm ơn tác giả!"
}
```

**Ví dụ — reply:**
```json
{
  "postId": 1,
  "parentId": 100,
  "content": "Tôi cũng thấy vậy!"
}
```

**Response:** Chi tiết comment vừa tạo.

**Lỗi:**
- `404` — Bài viết không tồn tại hoặc chưa publish
- `404` — Comment cha không tồn tại
- `403` — Comment cha thuộc bài viết khác
- `400` — Đã reply vào 1 reply (không hỗ trợ lồng sâu hơn 1 cấp)

---

### 10.2 Sửa bình luận

```
PUT /api/posts/user/post-comments/:id
Content-Type: application/json
```

| Field | Kiểu | Bắt buộc | Mô tả |
|-------|------|----------|-------|
| `content` | string | ✅ | Nội dung mới, 1–10000 ký tự |

> Chỉ được sửa **bình luận của chính mình**.

**Lỗi:**
- `404` — Comment không tồn tại
- `403` — Không phải comment của bạn

---

### 10.3 Xóa bình luận

```
DELETE /api/posts/user/post-comments/:id
```

> Chỉ xóa **bình luận của chính mình**. Nếu comment có replies, replies sẽ không bị xóa theo (replies sẽ có `parentId = null`).

**Response:**
```json
{ "success": true, "data": { "success": true } }
```

---

## 11. Bình luận — Admin

> Cần quyền `post.manage`.

### 11.1 Lấy danh sách bình luận (admin)

```
GET /api/posts/admin/post-comments
```

**Query params:**

| Param | Kiểu | Mô tả |
|-------|------|-------|
| `postId` | number | Lọc theo bài viết |
| `status` | string | `visible` \| `hidden` \| `spam` \| `deleted` |
| `userId` | number | Lọc theo người dùng |
| `page` | number | Trang |
| `limit` | number | Số item/trang |

---

### 11.2 Cập nhật trạng thái bình luận

```
PATCH /api/posts/admin/post-comments/:id
Content-Type: application/json
```

```json
{
  "status": "hidden"
}
```

`status` nhận một trong: `visible` | `hidden` | `spam` | `deleted`

---

## 12. Enum Reference

### PostStatus

| Giá trị | Nhãn |
|---------|------|
| `draft` | Nháp |
| `scheduled` | Lên lịch |
| `published` | Đã xuất bản |
| `archived` | Lưu trữ |

> Public API chỉ trả về bài `published`.

### PostType

| Giá trị | Nhãn |
|---------|------|
| `text` | Văn bản |
| `video` | Video |
| `image` | Hình ảnh |
| `audio` | Âm thanh |

### CategoryStatus / TagStatus

| Giá trị | Nhãn |
|---------|------|
| `active` | Hoạt động |
| `inactive` | Ngừng hoạt động |

### CommentStatus

| Giá trị | Nhãn |
|---------|------|
| `visible` | Hiển thị |
| `hidden` | Ẩn |
| `spam` | Spam |
| `deleted` | Đã xóa |

### Sort options (POST)

| Giá trị | Mô tả |
|---------|-------|
| `publishedAt:desc` | Mới nhất trước (default) |
| `publishedAt:asc` | Cũ nhất trước |
| `viewCount:desc` | Nhiều lượt xem nhất |
| `name:asc` | Tên A → Z |
| `name:desc` | Tên Z → A |
| `createdAt:desc` | Ngày tạo mới nhất |
| `updatedAt:desc` | Cập nhật gần nhất |

---

## 13. Lỗi thường gặp

| HTTP Code | Tình huống |
|-----------|-----------|
| `400` | Dữ liệu không hợp lệ (thiếu field bắt buộc, sai format, slug trùng, v.v.) |
| `401` | Chưa đăng nhập hoặc token hết hạn |
| `403` | Không có quyền (sửa comment của người khác, thiếu quyền admin) |
| `404` | Resource không tồn tại |
| `429` | Quá nhiều request (rate limit: 60 request/60 giây) |
| `500` | Lỗi server (báo lại team backend) |

---

## Ghi chú tích hợp

### Phân trang

`BaseListQueryDto` cung cấp sẵn:

| Param | Mô tả |
|-------|-------|
| `page` | Trang hiện tại (default: 1) |
| `limit` | Số item/trang (default: 10) |
| `search` | Tìm kiếm full-text |
| `sort` | Sắp xếp dạng `field:direction` |
| `skipCount` | Bỏ qua đếm tổng (tăng tốc query) |

### Cache

- Danh sách bài viết public: cache **60 giây**
- Chi tiết bài viết (slug): cache **120 giây**
- Danh mục và tag: cache **10 phút**
- Bình luận: cache **60 giây**

> Cache tự động bị xóa khi admin tạo/sửa/xóa. Nếu thấy dữ liệu cũ sau khi cập nhật, chờ tối đa thời gian cache trên.

### View counting

Mỗi lần GET `/public/posts/:slug`, hệ thống:
1. Kiểm tra user/IP đã xem bài hôm nay chưa (HyperLogLog)
2. Nếu chưa → tăng bộ đếm Redis
3. Mỗi 5 phút → flush vào database

`viewCount` trong response có thể **trễ tối đa 5 phút** so với thực tế.

### BigInt ID

ID trong hệ thống là BigInt. Được serialize thành `Number` trong JSON. Khi gửi ID trong URL hoặc body, gửi dạng số nguyên bình thường:
```
GET /api/posts/admin/posts/12345678
```
```json
{ "categoryIds": [1, 2, 3] }
```
