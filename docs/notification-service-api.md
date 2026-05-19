# Tài liệu tích hợp API — Notification Service

**Base URL:** `http://<host>/api/notifications`
**Service port:** `3005`
**Phiên bản:** 1.0

---

## Mục lục

1. [Xác thực](#1-xác-thực)
2. [Response format](#2-response-format)
3. [Error format](#3-error-format)
4. [Notification — User API](#4-notification--user-api)
   - [Lấy danh sách thông báo](#41-lấy-danh-sách-thông-báo)
   - [Đếm thông báo chưa đọc](#42-đếm-thông-báo-chưa-đọc)
   - [Lấy chi tiết thông báo](#43-lấy-chi-tiết-thông-báo)
   - [Đánh dấu đã đọc (một thông báo)](#44-đánh-dấu-đã-đọc-một-thông-báo)
   - [Đánh dấu đã đọc (tất cả)](#45-đánh-dấu-đã-đọc-tất-cả)
5. [Notification — Admin API](#5-notification--admin-api)
   - [Lấy danh sách (admin)](#51-lấy-danh-sách-admin)
   - [Gửi thông báo hàng loạt](#52-gửi-thông-báo-hàng-loạt)
   - [Xóa thông báo](#53-xóa-thông-báo)
6. [Content Template — Admin API](#6-content-template--admin-api)
   - [Lấy danh sách template](#61-lấy-danh-sách-template)
   - [Lấy chi tiết template](#62-lấy-chi-tiết-template)
   - [Tạo template](#63-tạo-template)
   - [Cập nhật template](#64-cập-nhật-template)
   - [Xóa template](#65-xóa-template)
7. [Enums & Constants](#7-enums--constants)

---

## 1. Xác thực

Tất cả endpoint đều yêu cầu JWT Bearer token trong header:

```
Authorization: Bearer <access_token>
```

| Nhóm endpoint | Yêu cầu |
|---|---|
| `user/notifications/*` | Đã đăng nhập (`@Authenticated`) |
| `admin/notifications/*` | Quyền `notification.manage` (`@Permission`) |
| `admin/content-templates/*` | Quyền `notification.manage` (`@Permission`) |

---

## 2. Response format

Mọi response thành công đều có cấu trúc:

```json
{
  "success": true,
  "data": { ... },
  "meta": { ... },
  "timestamp": "2026-05-18T10:00:00.000Z"
}
```

**Response danh sách (paginated):**

```json
{
  "success": true,
  "data": [ ... ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8
  },
  "timestamp": "2026-05-18T10:00:00.000Z"
}
```

> **Lưu ý:** Các trường `id`, `userId` trả về dạng **string** (do BigInt serialize).

---

## 3. Error format

```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Không tìm thấy thông báo"
  },
  "timestamp": "2026-05-18T10:00:00.000Z"
}
```

| HTTP Status | Ý nghĩa |
|---|---|
| `400` | Dữ liệu đầu vào không hợp lệ |
| `401` | Chưa đăng nhập hoặc token hết hạn |
| `403` | Không có quyền truy cập |
| `404` | Không tìm thấy resource |
| `409` | Trùng lặp dữ liệu (ví dụ: `code` template đã tồn tại) |

---

## 4. Notification — User API

> Tất cả endpoint dưới đây yêu cầu user đã đăng nhập. `userId` tự động lấy từ JWT — **không cần truyền trong request**.

---

### 4.1 Lấy danh sách thông báo

```
GET /api/notifications/user/notifications
```

**Query params:**

| Param | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|
| `page` | number | Không | Số trang (mặc định: `1`) |
| `limit` | number | Không | Số bản ghi/trang (mặc định: `20`, max: `100`) |
| `type` | string | Không | Lọc theo loại: `info` \| `success` \| `warning` \| `error` |
| `isRead` | boolean string | Không | Lọc theo trạng thái đọc: `"true"` \| `"false"` |
| `sortBy` | string | Không | Field sắp xếp (mặc định: `createdAt`) |
| `order` | string | Không | `"asc"` \| `"desc"` (mặc định: `"desc"`) |
| `skipCount` | boolean string | Không | `"true"` để bỏ qua đếm tổng (tăng hiệu năng) |

**Ví dụ request:**

```
GET /api/notifications/user/notifications?page=1&limit=20&isRead=false
```

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "id": "1234567890",
      "userId": "9876543210",
      "title": "One Piece - Chapter 1100",
      "message": "Chương mới đã được cập nhật: Chapter 1100",
      "type": "info",
      "data": {
        "comic_id": "123",
        "comic_slug": "one-piece",
        "chapter_label": "Chapter 1100"
      },
      "isRead": false,
      "readAt": null,
      "status": "active",
      "createdAt": "2026-05-18T09:00:00.000Z",
      "updatedAt": "2026-05-18T09:00:00.000Z"
    }
  ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 5,
    "totalPages": 1
  },
  "timestamp": "2026-05-18T10:00:00.000Z"
}
```

---

### 4.2 Đếm thông báo chưa đọc

```
GET /api/notifications/user/notifications/unread/count
```

> Kết quả được cache Redis 30 giây. Dùng cho badge/indicator trên UI.

**Response:**

```json
{
  "success": true,
  "data": {
    "count": 12
  },
  "timestamp": "2026-05-18T10:00:00.000Z"
}
```

---

### 4.3 Lấy chi tiết thông báo

```
GET /api/notifications/user/notifications/:id
```

**Path params:**

| Param | Kiểu | Mô tả |
|---|---|---|
| `id` | string (numeric) | ID thông báo |

> Chỉ trả về thông báo thuộc về user đang đăng nhập. Trả về `404` nếu không tìm thấy hoặc không thuộc user.

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "1234567890",
    "userId": "9876543210",
    "title": "One Piece - Chapter 1100",
    "message": "Chương mới đã được cập nhật: Chapter 1100",
    "type": "info",
    "data": {
      "comic_id": "123",
      "comic_slug": "one-piece",
      "chapter_label": "Chapter 1100"
    },
    "isRead": false,
    "readAt": null,
    "status": "active",
    "createdAt": "2026-05-18T09:00:00.000Z",
    "updatedAt": "2026-05-18T09:00:00.000Z"
  },
  "timestamp": "2026-05-18T10:00:00.000Z"
}
```

---

### 4.4 Đánh dấu đã đọc (một thông báo)

```
PATCH /api/notifications/user/notifications/:id/read
```

**Path params:**

| Param | Kiểu | Mô tả |
|---|---|---|
| `id` | string (numeric) | ID thông báo |

> Cập nhật `isRead = true` và `readAt = now()`. Tự động xóa cache đếm chưa đọc của user.

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "1234567890",
    "isRead": true,
    "readAt": "2026-05-18T10:05:00.000Z"
  },
  "timestamp": "2026-05-18T10:05:00.000Z"
}
```

---

### 4.5 Đánh dấu đã đọc (tất cả)

```
PATCH /api/notifications/user/notifications/read-all
```

> Đánh dấu tất cả thông báo chưa đọc của user thành đã đọc. Xóa cache đếm.

**Response:**

```json
{
  "success": true,
  "data": {
    "updated": 12
  },
  "timestamp": "2026-05-18T10:05:00.000Z"
}
```

---

## 5. Notification — Admin API

> Yêu cầu quyền `notification.manage`.

---

### 5.1 Lấy danh sách (admin)

```
GET /api/notifications/admin/notifications
```

**Query params:**

| Param | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|
| `page` | number | Không | Số trang |
| `limit` | number | Không | Số bản ghi/trang |
| `userId` | string (numeric) | Không | Lọc theo user ID |
| `type` | string | Không | `info` \| `success` \| `warning` \| `error` |
| `status` | string | Không | `active` \| `archived` \| `deleted` |
| `isRead` | boolean string | Không | `"true"` \| `"false"` |
| `sortBy` | string | Không | Field sắp xếp |
| `order` | string | Không | `"asc"` \| `"desc"` |

**Response:** Tương tự cấu trúc paginated ở [mục 4.1](#41-lấy-danh-sách-thông-báo).

---

### 5.2 Gửi thông báo hàng loạt

```
POST /api/notifications/admin/notifications/send
```

**Request body:**

```json
{
  "userIds": ["1001", "1002", "1003"],
  "title": "Thông báo bảo trì hệ thống",
  "message": "Hệ thống sẽ bảo trì lúc 2:00 AM ngày 20/05/2026. Vui lòng lưu lại công việc.",
  "type": "warning",
  "data": {
    "link": "/announcements/123"
  }
}
```

**Validation:**

| Field | Kiểu | Bắt buộc | Ràng buộc |
|---|---|---|---|
| `userIds` | string[] | Có | Mảng ID số, tối thiểu 1, tối đa **500** phần tử, không trùng lặp |
| `title` | string | Có | Tối đa 255 ký tự |
| `message` | string | Có | Tối đa 5.000 ký tự |
| `type` | string | Không | `info` \| `success` \| `warning` \| `error` (mặc định: `info`) |
| `data` | object | Không | Dữ liệu JSON tùy ý kèm theo thông báo |

**Response:**

```json
{
  "success": true,
  "data": {
    "sent": 3
  },
  "timestamp": "2026-05-18T10:00:00.000Z"
}
```

---

### 5.3 Xóa thông báo

```
DELETE /api/notifications/admin/notifications/:id
```

**Path params:**

| Param | Kiểu | Mô tả |
|---|---|---|
| `id` | string (numeric) | ID thông báo |

**Response:**

```json
{
  "success": true,
  "data": null,
  "timestamp": "2026-05-18T10:00:00.000Z"
}
```

---

## 6. Content Template — Admin API

> Yêu cầu quyền `notification.manage`. Template được dùng để gửi email tự động (chào mừng, đặt lại mật khẩu, v.v.).

---

### 6.1 Lấy danh sách template

```
GET /api/notifications/admin/content-templates
```

**Query params:**

| Param | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|
| `page` | number | Không | Số trang (mặc định: `1`) |
| `limit` | number | Không | Số bản ghi/trang (mặc định: `20`) |
| `search` | string | Không | Tìm kiếm theo `name` hoặc `code` |
| `type` | string | Không | `email` \| `telegram` \| `zalo` \| `sms` |
| `category` | string | Không | `render` \| `file` |
| `status` | string | Không | `active` \| `inactive` |
| `sortBy` | string | Không | Field sắp xếp |
| `order` | string | Không | `"asc"` \| `"desc"` |

**Ví dụ request:**

```
GET /api/notifications/admin/content-templates?type=email&status=active&page=1&limit=20
```

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "id": "1",
      "code": "registration_success",
      "name": "Chào mừng đăng ký thành công",
      "category": "render",
      "type": "email",
      "content": "<h1>Xin chào {{name}}</h1><p>Tài khoản {{username}} đã được tạo thành công.</p>",
      "filePath": null,
      "metadata": {
        "subject": "Chào mừng bạn đến với Comic Platform"
      },
      "variables": {
        "name": "Họ tên người dùng",
        "username": "Tên đăng nhập",
        "email": "Địa chỉ email"
      },
      "status": "active",
      "createdAt": "2026-01-01T00:00:00.000Z",
      "updatedAt": "2026-05-01T00:00:00.000Z"
    }
  ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 5,
    "totalPages": 1
  },
  "timestamp": "2026-05-18T10:00:00.000Z"
}
```

---

### 6.2 Lấy chi tiết template

```
GET /api/notifications/admin/content-templates/:id
```

**Path params:**

| Param | Kiểu | Mô tả |
|---|---|---|
| `id` | string (numeric) | ID template |

**Response:** Object template đầy đủ (cấu trúc như trên).

---

### 6.3 Tạo template

```
POST /api/notifications/admin/content-templates
```

**Request body:**

```json
{
  "code": "registration_success",
  "name": "Chào mừng đăng ký thành công",
  "category": "render",
  "type": "email",
  "content": "<h1>Xin chào {{name}}</h1><p>Tài khoản <strong>{{username}}</strong> đã được tạo thành công.</p>",
  "metadata": {
    "subject": "Chào mừng bạn đến với Comic Platform"
  },
  "variables": {
    "name": "Họ tên người dùng",
    "username": "Tên đăng nhập",
    "email": "Địa chỉ email"
  }
}
```

**Validation:**

| Field | Kiểu | Bắt buộc | Ràng buộc |
|---|---|---|---|
| `code` | string | Có | Bắt đầu bằng chữ thường, chỉ gồm `[a-z0-9_]`, tối đa 100 ký tự. **Unique.** |
| `name` | string | Có | 1–255 ký tự |
| `category` | string | Không | `render` (mặc định) \| `file` |
| `type` | string | Có | `email` \| `telegram` \| `zalo` \| `sms` |
| `content` | string | Không | Tối đa 200.000 ký tự (200KB). Dùng khi `category = render` |
| `filePath` | string | Không | Tối đa 500 ký tự. Dùng khi `category = file` |
| `metadata` | object | Không | JSON tùy ý. Email dùng để truyền `subject` |
| `variables` | object | Không | Mô tả các biến template dùng cho tài liệu nội bộ |

**Template variable syntax:** `{{variableName}}` — ví dụ: `{{name}}`, `{{username}}`.

**Response:** Object template vừa tạo.

---

### 6.4 Cập nhật template

```
PUT /api/notifications/admin/content-templates/:id
```

**Path params:**

| Param | Kiểu | Mô tả |
|---|---|---|
| `id` | string (numeric) | ID template |

**Request body:** Tương tự Create, nhưng **tất cả field đều tùy chọn** (chỉ truyền field cần thay đổi).

```json
{
  "content": "<h1>Xin chào {{name}}</h1><p>Nội dung mới...</p>",
  "metadata": {
    "subject": "Tiêu đề email mới"
  }
}
```

**Response:** Object template sau khi cập nhật.

---

### 6.5 Xóa template

```
DELETE /api/notifications/admin/content-templates/:id
```

**Path params:**

| Param | Kiểu | Mô tả |
|---|---|---|
| `id` | string (numeric) | ID template |

**Response:**

```json
{
  "success": true,
  "data": null,
  "timestamp": "2026-05-18T10:00:00.000Z"
}
```

---

## 7. Enums & Constants

### Notification type

| Giá trị | Mô tả |
|---|---|
| `info` | Thông tin thông thường |
| `success` | Thành công |
| `warning` | Cảnh báo |
| `error` | Lỗi |

### Notification status

| Giá trị | Mô tả |
|---|---|
| `active` | Đang hoạt động (hiển thị cho user) |
| `archived` | Đã lưu trữ |
| `deleted` | Đã xóa |

### Template type

| Giá trị | Mô tả |
|---|---|
| `email` | Gửi qua email |
| `telegram` | Gửi qua Telegram |
| `zalo` | Gửi qua Zalo |
| `sms` | Gửi qua SMS |

### Template category

| Giá trị | Mô tả |
|---|---|
| `render` | Nội dung template lưu trong field `content`, render tại server |
| `file` | Template lưu trong file, đường dẫn trong field `filePath` |

### Template status

| Giá trị | Mô tả |
|---|---|
| `active` | Đang hoạt động, được dùng để gửi email |
| `inactive` | Tạm ngừng |

---

## Phụ lục: Template code hệ thống

Các template code sau được hệ thống dùng nội bộ qua Kafka events. **Không được xóa hoặc đổi `code`.**

| Code | Event kích hoạt | Biến template |
|---|---|---|
| `registration_success` | `user.registered` | `name`, `username`, `email` |
| `reset_password_success` | `user.password.reset` | `name`, `username`, `time` |
| `contact_submitted` | `contact.submitted` | `name`, `email`, `phone`, `subject`, `message` |

---

*Tài liệu sinh ngày 2026-05-18. Liên hệ team backend nếu có thắc mắc.*
