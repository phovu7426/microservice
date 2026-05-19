# Tài liệu tích hợp API — CMS Service

**Base URL:** `http://<host>/api/cms`
**Service port:** `3006`
**Phiên bản:** 1.0

---

## Mục lục

1. [Xác thực](#1-xác-thực)
2. [Response format](#2-response-format)
3. [Error format](#3-error-format)
4. [Shared enums](#4-shared-enums)
5. [About Sections — Giới thiệu](#5-about-sections)
6. [Staff — Nhân sự](#6-staff)
7. [Projects — Dự án](#7-projects)
8. [Testimonials — Đánh giá khách hàng](#8-testimonials)
9. [Partners — Đối tác](#9-partners)
10. [Gallery — Thư viện ảnh](#10-gallery)
11. [Certificates — Chứng chỉ](#11-certificates)
12. [FAQ](#12-faq)
13. [Banners — Banner quảng cáo](#13-banners)
14. [Banner Locations — Vị trí banner](#14-banner-locations)
15. [Contacts — Liên hệ](#15-contacts)

---

## 1. Xác thực

```
Authorization: Bearer <access_token>
```

| Nhóm endpoint | Yêu cầu |
|---|---|
| `public/*` | Công khai, không cần token |
| `admin/*` (nhóm Introduction) | Quyền `introduction.manage` |
| `admin/*` (nhóm Marketing) | Quyền `marketing.manage` |

**Nhóm Introduction** (dùng quyền `introduction.manage`): About Sections, Staff, Projects, Testimonials, Partners, Gallery, Certificates, FAQ.

**Nhóm Marketing** (dùng quyền `marketing.manage`): Banners, Banner Locations, Contacts.

---

## 2. Response format

**Response đơn:**

```json
{
  "success": true,
  "data": { ... },
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

> **Lưu ý:** Các trường `id`, `projectId`, `locationId` trả về dạng **string** (BigInt serialize).

### Query params chung (áp dụng cho tất cả endpoint danh sách)

| Param | Kiểu | Mô tả |
|---|---|---|
| `page` | number | Số trang (mặc định: `1`) |
| `limit` | number | Bản ghi/trang (mặc định: `20`, max: `100`) |
| `search` | string | Tìm kiếm text (tuỳ module) |
| `sortBy` | string | Field sắp xếp |
| `order` | `asc` \| `desc` | Chiều sắp xếp (mặc định: `desc`) |
| `skipCount` | `"true"` | Bỏ qua đếm `total` để tăng hiệu năng |

---

## 3. Error format

```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Không tìm thấy bản ghi"
  },
  "timestamp": "2026-05-18T10:00:00.000Z"
}
```

| HTTP Status | Ý nghĩa |
|---|---|
| `400` | Dữ liệu đầu vào không hợp lệ |
| `401` | Chưa đăng nhập hoặc token hết hạn |
| `403` | Không có quyền |
| `404` | Không tìm thấy resource |
| `409` | Trùng lặp (slug, code) |
| `429` | Rate limit (public form) |

---

## 4. Shared enums

### BasicStatus (dùng cho hầu hết module)

| Giá trị | Mô tả |
|---|---|
| `active` | Hoạt động — hiển thị ở public |
| `inactive` | Tạm ngừng — ẩn ở public |
| `draft` | Nháp — chưa hoàn thiện, ẩn ở public |

### BannerStatus

| Giá trị | Mô tả |
|---|---|
| `active` | Đang chạy |
| `inactive` | Tạm dừng |
| `draft` | Nháp |

### ContactStatus

| Giá trị | Mô tả |
|---|---|
| `Pending` | Chờ xử lý |
| `Read` | Đã đọc |
| `Replied` | Đã trả lời |
| `Closed` | Đã đóng |

---

## 5. About Sections

Quản lý các section giới thiệu doanh nghiệp (sứ mệnh, tầm nhìn, lịch sử…).

### 5.1 Admin API

**Yêu cầu quyền:** `introduction.manage`

| Method | Endpoint | Mô tả |
|---|---|---|
| `GET` | `/api/cms/admin/about-sections` | Danh sách |
| `GET` | `/api/cms/admin/about-sections/:id` | Chi tiết |
| `POST` | `/api/cms/admin/about-sections` | Tạo mới |
| `PATCH` | `/api/cms/admin/about-sections/:id` | Cập nhật |
| `DELETE` | `/api/cms/admin/about-sections/:id` | Xóa |

**Query params (GET list admin):**

| Param | Kiểu | Mô tả |
|---|---|---|
| `status` | `BasicStatus` | Lọc theo trạng thái |
| `sectionType` | string | Lọc theo loại section |

**Request body (POST/PATCH):**

| Field | Kiểu | Bắt buộc | Ràng buộc |
|---|---|---|---|
| `title` | string | Có | Tối đa 255 ký tự |
| `slug` | string | Không | Tối đa 255 ký tự. Tự sinh nếu bỏ qua |
| `content` | string | Không | Tối đa 20.000 ký tự |
| `image` | string (URL) | Không | URL http(s) hợp lệ |
| `videoUrl` | string (URL) | Không | URL http(s) hợp lệ |
| `sectionType` | string | Không | `general` \| `mission` \| `vision` \| `history` \| `values` |
| `status` | `BasicStatus` | Không | Mặc định: `active` |
| `sortOrder` | number | Không | ≥ 0, mặc định: `0` |

**Ví dụ tạo mới:**

```json
POST /api/cms/admin/about-sections
{
  "title": "Sứ mệnh của chúng tôi",
  "sectionType": "mission",
  "content": "<p>Chúng tôi cam kết mang lại...</p>",
  "image": "https://cdn.example.com/mission.jpg",
  "status": "active",
  "sortOrder": 1
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "1",
    "title": "Sứ mệnh của chúng tôi",
    "slug": "su-menh-cua-chung-toi",
    "content": "<p>Chúng tôi cam kết mang lại...</p>",
    "image": "https://cdn.example.com/mission.jpg",
    "videoUrl": null,
    "sectionType": "mission",
    "status": "active",
    "sortOrder": 1,
    "createdAt": "2026-05-18T10:00:00.000Z",
    "updatedAt": "2026-05-18T10:00:00.000Z"
  },
  "timestamp": "2026-05-18T10:00:00.000Z"
}
```

---

### 5.2 Public API

| Method | Endpoint | Mô tả |
|---|---|---|
| `GET` | `/api/cms/public/about-sections` | Danh sách (chỉ `status=active`) |
| `GET` | `/api/cms/public/about-sections/:slug` | Chi tiết theo slug |

> Kết quả được cache Redis: 300s (list), 600s (detail).

**Query params (GET list public):**

| Param | Kiểu | Mô tả |
|---|---|---|
| `sectionType` | string | Lọc theo loại section |

---

## 6. Staff

Quản lý danh sách nhân sự, thành viên nhóm.

### 6.1 Admin API

**Yêu cầu quyền:** `introduction.manage`

| Method | Endpoint | Mô tả |
|---|---|---|
| `GET` | `/api/cms/admin/staff` | Danh sách |
| `GET` | `/api/cms/admin/staff/:id` | Chi tiết |
| `POST` | `/api/cms/admin/staff` | Tạo mới |
| `PATCH` | `/api/cms/admin/staff/:id` | Cập nhật |
| `DELETE` | `/api/cms/admin/staff/:id` | Xóa |

**Query params (GET list admin):**

| Param | Kiểu | Mô tả |
|---|---|---|
| `status` | `BasicStatus` | Lọc theo trạng thái |
| `department` | string | Lọc theo phòng ban |

**Request body (POST/PATCH):**

| Field | Kiểu | Bắt buộc | Ràng buộc |
|---|---|---|---|
| `name` | string | Có | Tối đa 255 ký tự |
| `position` | string | Không | Tối đa 255 ký tự |
| `department` | string | Không | Tối đa 255 ký tự |
| `bio` | string | Không | Tối đa 5.000 ký tự |
| `avatar` | string (URL) | Không | URL http(s) hợp lệ |
| `email` | string | Không | Email hợp lệ, tối đa 255 ký tự |
| `phone` | string | Không | Pattern: `+?[0-9 .-]{6,50}` |
| `socialLinks` | object | Không | JSON key-value (ví dụ: `{"facebook": "...", "linkedin": "..."}`) |
| `experience` | string | Không | Tối đa 5.000 ký tự |
| `expertise` | string | Không | Tối đa 5.000 ký tự |
| `status` | `BasicStatus` | Không | Mặc định: `active` |
| `sortOrder` | number | Không | ≥ 0 |

**Ví dụ:**

```json
POST /api/cms/admin/staff
{
  "name": "Nguyễn Văn A",
  "position": "Giám đốc kỹ thuật",
  "department": "Engineering",
  "bio": "Hơn 10 năm kinh nghiệm...",
  "avatar": "https://cdn.example.com/avatar-a.jpg",
  "email": "nguyenvana@example.com",
  "socialLinks": {
    "linkedin": "https://linkedin.com/in/nguyenvana"
  },
  "status": "active",
  "sortOrder": 1
}
```

> **Lưu ý FE:** `socialLinks` là object mở. Khi render link mạng xã hội, **kiểm tra và chỉ chấp nhận URL http(s)** để tránh open-redirect.

---

### 6.2 Public API

| Method | Endpoint | Mô tả |
|---|---|---|
| `GET` | `/api/cms/public/staff` | Danh sách (chỉ `status=active`) |
| `GET` | `/api/cms/public/staff/:id` | Chi tiết |

**Query params (GET list public):**

| Param | Kiểu | Mô tả |
|---|---|---|
| `department` | string | Lọc theo phòng ban |

---

## 7. Projects

Quản lý danh mục dự án.

### 7.1 Admin API

**Yêu cầu quyền:** `introduction.manage`

| Method | Endpoint | Mô tả |
|---|---|---|
| `GET` | `/api/cms/admin/projects` | Danh sách |
| `GET` | `/api/cms/admin/projects/:id` | Chi tiết |
| `POST` | `/api/cms/admin/projects` | Tạo mới |
| `PATCH` | `/api/cms/admin/projects/:id` | Cập nhật |
| `DELETE` | `/api/cms/admin/projects/:id` | Xóa |

**Query params (GET list admin):**

| Param | Kiểu | Mô tả |
|---|---|---|
| `status` | `ProjectStatus` | Lọc theo trạng thái |
| `featured` | `"true"` \| `"false"` | Lọc dự án nổi bật |

**ProjectStatus enum:**

| Giá trị | Mô tả |
|---|---|
| `planning` | Đang lên kế hoạch |
| `in_progress` | Đang thực hiện |
| `completed` | Hoàn thành |
| `cancelled` | Đã hủy |

**Request body (POST/PATCH):**

| Field | Kiểu | Bắt buộc | Ràng buộc |
|---|---|---|---|
| `name` | string | Có | Tối đa 255 ký tự |
| `slug` | string | Không | Tối đa 255 ký tự. Tự sinh nếu bỏ qua |
| `description` | string | Không | Không giới hạn |
| `shortDescription` | string | Không | Tối đa 500 ký tự |
| `coverImage` | string (URL) | Không | URL http(s) hợp lệ |
| `location` | string | Không | Tối đa 255 ký tự |
| `area` | string | Không | Tối đa 255 ký tự |
| `startDate` | string (date) | Không | Định dạng ISO 8601 (`YYYY-MM-DD`) |
| `endDate` | string (date) | Không | Định dạng ISO 8601 |
| `status` | `ProjectStatus` | Không | Mặc định: `planning` |
| `clientName` | string | Không | Tối đa 255 ký tự |
| `budget` | string | Không | Tối đa 255 ký tự (text tự do) |
| `images` | array | Không | Tối đa 200 phần tử |
| `featured` | boolean | Không | Mặc định: `false` |
| `sortOrder` | number | Không | ≥ 0 |
| `seoTitle` | string | Không | Tối đa 255 ký tự |
| `seoDescription` | string | Không | Tối đa 500 ký tự |
| `seoKeywords` | string | Không | Tối đa 500 ký tự |

**Ví dụ:**

```json
POST /api/cms/admin/projects
{
  "name": "Tòa nhà Sunrise Tower",
  "shortDescription": "Dự án văn phòng cao cấp tại Hà Nội",
  "coverImage": "https://cdn.example.com/sunrise.jpg",
  "location": "Hà Nội",
  "area": "5000 m²",
  "startDate": "2025-01-01",
  "endDate": "2026-06-30",
  "status": "in_progress",
  "clientName": "Sunrise Group",
  "featured": true,
  "images": [
    "https://cdn.example.com/sunrise-1.jpg",
    "https://cdn.example.com/sunrise-2.jpg"
  ]
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "10",
    "name": "Tòa nhà Sunrise Tower",
    "slug": "toa-nha-sunrise-tower",
    "shortDescription": "Dự án văn phòng cao cấp tại Hà Nội",
    "coverImage": "https://cdn.example.com/sunrise.jpg",
    "location": "Hà Nội",
    "area": "5000 m²",
    "startDate": "2025-01-01",
    "endDate": "2026-06-30",
    "status": "in_progress",
    "clientName": "Sunrise Group",
    "images": ["https://cdn.example.com/sunrise-1.jpg", "..."],
    "featured": true,
    "viewCount": 0,
    "sortOrder": 0,
    "seoTitle": null,
    "seoDescription": null,
    "seoKeywords": null,
    "createdAt": "2026-05-18T10:00:00.000Z",
    "updatedAt": "2026-05-18T10:00:00.000Z"
  },
  "timestamp": "2026-05-18T10:00:00.000Z"
}
```

---

### 7.2 Public API

| Method | Endpoint | Mô tả |
|---|---|---|
| `GET` | `/api/cms/public/projects` | Danh sách |
| `GET` | `/api/cms/public/projects/:slug` | Chi tiết theo slug |

**Query params (GET list public):**

| Param | Kiểu | Mô tả |
|---|---|---|
| `featured` | `"true"` \| `"false"` | Lọc dự án nổi bật |

---

## 8. Testimonials

Quản lý đánh giá / nhận xét của khách hàng.

### 8.1 Admin API

**Yêu cầu quyền:** `introduction.manage`

| Method | Endpoint | Mô tả |
|---|---|---|
| `GET` | `/api/cms/admin/testimonials` | Danh sách |
| `GET` | `/api/cms/admin/testimonials/:id` | Chi tiết |
| `POST` | `/api/cms/admin/testimonials` | Tạo mới |
| `PATCH` | `/api/cms/admin/testimonials/:id` | Cập nhật |
| `DELETE` | `/api/cms/admin/testimonials/:id` | Xóa |

**Query params (GET list admin):**

| Param | Kiểu | Mô tả |
|---|---|---|
| `status` | `BasicStatus` | Lọc theo trạng thái |
| `featured` | `"true"` \| `"false"` | Lọc testimonial nổi bật |
| `projectId` | string (numeric) | Lọc theo dự án |

**Request body (POST/PATCH):**

| Field | Kiểu | Bắt buộc | Ràng buộc |
|---|---|---|---|
| `clientName` | string | Có | Tối đa 255 ký tự |
| `clientPosition` | string | Không | Tối đa 255 ký tự |
| `clientCompany` | string | Không | Tối đa 255 ký tự |
| `clientAvatar` | string (URL) | Không | URL http(s) hợp lệ |
| `content` | string | Có | Tối đa 5.000 ký tự |
| `rating` | number | Không | 1–5 (số sao) |
| `projectId` | number | Không | ID dự án liên quan |
| `featured` | boolean | Không | Mặc định: `false` |
| `status` | `BasicStatus` | Không | Mặc định: `active` |
| `sortOrder` | number | Không | ≥ 0 |

**Ví dụ:**

```json
POST /api/cms/admin/testimonials
{
  "clientName": "Trần Thị B",
  "clientPosition": "CEO",
  "clientCompany": "ABC Corp",
  "clientAvatar": "https://cdn.example.com/avatar-b.jpg",
  "content": "Dịch vụ tuyệt vời, đúng tiến độ và chất lượng vượt mong đợi.",
  "rating": 5,
  "projectId": 10,
  "featured": true,
  "status": "active"
}
```

---

### 8.2 Public API

| Method | Endpoint | Mô tả |
|---|---|---|
| `GET` | `/api/cms/public/testimonials` | Danh sách |
| `GET` | `/api/cms/public/testimonials/:id` | Chi tiết |

**Query params (GET list public):**

| Param | Kiểu | Mô tả |
|---|---|---|
| `featured` | `"true"` \| `"false"` | Lọc nổi bật |
| `projectId` | string (numeric) | Lọc theo dự án |

---

## 9. Partners

Quản lý danh sách đối tác.

### 9.1 Admin API

**Yêu cầu quyền:** `introduction.manage`

| Method | Endpoint | Mô tả |
|---|---|---|
| `GET` | `/api/cms/admin/partners` | Danh sách |
| `GET` | `/api/cms/admin/partners/:id` | Chi tiết |
| `POST` | `/api/cms/admin/partners` | Tạo mới |
| `PATCH` | `/api/cms/admin/partners/:id` | Cập nhật |
| `DELETE` | `/api/cms/admin/partners/:id` | Xóa |

**Query params (GET list admin):**

| Param | Kiểu | Mô tả |
|---|---|---|
| `status` | `BasicStatus` | Lọc theo trạng thái |
| `type` | string | Lọc theo loại đối tác |

**Request body (POST/PATCH):**

| Field | Kiểu | Bắt buộc | Ràng buộc |
|---|---|---|---|
| `name` | string | Có | Tối đa 255 ký tự |
| `logo` | string (URL) | Không | URL http(s) hợp lệ |
| `website` | string (URL) | Không | URL http(s) hợp lệ |
| `description` | string | Không | Tối đa 2.000 ký tự |
| `type` | string | Không | Chỉ `[a-z0-9_-]`, tối đa 50 ký tự |
| `status` | `BasicStatus` | Không | Mặc định: `active` |
| `sortOrder` | number | Không | ≥ 0 |

---

### 9.2 Public API

| Method | Endpoint | Mô tả |
|---|---|---|
| `GET` | `/api/cms/public/partners` | Danh sách |
| `GET` | `/api/cms/public/partners/:id` | Chi tiết |

**Query params (GET list public):**

| Param | Kiểu | Mô tả |
|---|---|---|
| `type` | string | Lọc theo loại đối tác |

---

## 10. Gallery

Quản lý album ảnh / thư viện hình ảnh.

### 10.1 Admin API

**Yêu cầu quyền:** `introduction.manage`

| Method | Endpoint | Mô tả |
|---|---|---|
| `GET` | `/api/cms/admin/galleries` | Danh sách |
| `GET` | `/api/cms/admin/galleries/:id` | Chi tiết |
| `POST` | `/api/cms/admin/galleries` | Tạo mới |
| `PATCH` | `/api/cms/admin/galleries/:id` | Cập nhật |
| `DELETE` | `/api/cms/admin/galleries/:id` | Xóa |

**Query params (GET list admin):**

| Param | Kiểu | Mô tả |
|---|---|---|
| `status` | `BasicStatus` | Lọc theo trạng thái |
| `featured` | `"true"` \| `"false"` | Lọc album nổi bật |

**Request body (POST/PATCH):**

| Field | Kiểu | Bắt buộc | Ràng buộc |
|---|---|---|---|
| `title` | string | Có | Tối đa 255 ký tự |
| `slug` | string | Không | Tối đa 255 ký tự. Tự sinh nếu bỏ qua |
| `description` | string | Không | Tối đa 5.000 ký tự |
| `coverImage` | string (URL) | Không | URL http(s) hợp lệ |
| `images` | array | Không | Tối đa **200 phần tử** |
| `featured` | boolean | Không | Mặc định: `false` |
| `status` | `BasicStatus` | Không | Mặc định: `active` |
| `sortOrder` | number | Không | ≥ 0 |

**Ví dụ:**

```json
POST /api/cms/admin/galleries
{
  "title": "Lễ khánh thành dự án Sunrise Tower",
  "coverImage": "https://cdn.example.com/event-cover.jpg",
  "images": [
    "https://cdn.example.com/event-1.jpg",
    "https://cdn.example.com/event-2.jpg"
  ],
  "featured": true,
  "status": "active"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "5",
    "title": "Lễ khánh thành dự án Sunrise Tower",
    "slug": "le-khanh-thanh-du-an-sunrise-tower",
    "description": null,
    "coverImage": "https://cdn.example.com/event-cover.jpg",
    "images": [
      "https://cdn.example.com/event-1.jpg",
      "https://cdn.example.com/event-2.jpg"
    ],
    "featured": true,
    "status": "active",
    "sortOrder": 0,
    "createdAt": "2026-05-18T10:00:00.000Z",
    "updatedAt": "2026-05-18T10:00:00.000Z"
  },
  "timestamp": "2026-05-18T10:00:00.000Z"
}
```

---

### 10.2 Public API

| Method | Endpoint | Mô tả |
|---|---|---|
| `GET` | `/api/cms/public/galleries` | Danh sách |
| `GET` | `/api/cms/public/galleries/:slug` | Chi tiết theo slug |

**Query params (GET list public):**

| Param | Kiểu | Mô tả |
|---|---|---|
| `featured` | `"true"` \| `"false"` | Lọc album nổi bật |

---

## 11. Certificates

Quản lý chứng chỉ, giải thưởng của doanh nghiệp.

### 11.1 Admin API

**Yêu cầu quyền:** `introduction.manage`

| Method | Endpoint | Mô tả |
|---|---|---|
| `GET` | `/api/cms/admin/certificates` | Danh sách |
| `GET` | `/api/cms/admin/certificates/:id` | Chi tiết |
| `POST` | `/api/cms/admin/certificates` | Tạo mới |
| `PATCH` | `/api/cms/admin/certificates/:id` | Cập nhật |
| `DELETE` | `/api/cms/admin/certificates/:id` | Xóa |

**Query params (GET list admin):**

| Param | Kiểu | Mô tả |
|---|---|---|
| `status` | `BasicStatus` | Lọc theo trạng thái |
| `type` | string | Lọc theo loại chứng chỉ |

**CertificateType enum:**

| Giá trị | Mô tả |
|---|---|
| `iso` | Chứng nhận ISO |
| `quality` | Chứng nhận chất lượng |
| `safety` | Chứng nhận an toàn |
| `environment` | Chứng nhận môi trường |
| `other` | Loại khác |

**Request body (POST/PATCH):**

| Field | Kiểu | Bắt buộc | Ràng buộc |
|---|---|---|---|
| `name` | string | Có | Tối đa 255 ký tự |
| `image` | string (URL) | Không | URL http(s) hợp lệ |
| `issuedBy` | string | Không | Tối đa 255 ký tự (tổ chức cấp) |
| `issuedDate` | string (date) | Không | Định dạng ISO 8601 (`YYYY-MM-DD`) |
| `expiryDate` | string (date) | Không | Định dạng ISO 8601 |
| `certificateNumber` | string | Không | Tối đa 255 ký tự |
| `description` | string | Không | Tối đa 5.000 ký tự |
| `type` | `CertificateType` | Không | Xem bảng enum trên |
| `status` | `BasicStatus` | Không | Mặc định: `active` |
| `sortOrder` | number | Không | ≥ 0 |

---

### 11.2 Public API

| Method | Endpoint | Mô tả |
|---|---|---|
| `GET` | `/api/cms/public/certificates` | Danh sách |
| `GET` | `/api/cms/public/certificates/:id` | Chi tiết |

**Query params (GET list public):**

| Param | Kiểu | Mô tả |
|---|---|---|
| `type` | string | Lọc theo loại chứng chỉ |

---

## 12. FAQ

Quản lý câu hỏi thường gặp.

### 12.1 Admin API

**Yêu cầu quyền:** `introduction.manage`

| Method | Endpoint | Mô tả |
|---|---|---|
| `GET` | `/api/cms/admin/faqs` | Danh sách |
| `GET` | `/api/cms/admin/faqs/:id` | Chi tiết |
| `POST` | `/api/cms/admin/faqs` | Tạo mới |
| `PATCH` | `/api/cms/admin/faqs/:id` | Cập nhật |
| `DELETE` | `/api/cms/admin/faqs/:id` | Xóa |

**Query params (GET list admin):**

| Param | Kiểu | Mô tả |
|---|---|---|
| `status` | `BasicStatus` | Lọc theo trạng thái |

**Request body (POST/PATCH):**

| Field | Kiểu | Bắt buộc | Ràng buộc |
|---|---|---|---|
| `question` | string | Có | Tối đa 500 ký tự |
| `answer` | string | Có | Tối đa 20.000 ký tự |
| `status` | `BasicStatus` | Không | Mặc định: `active` |
| `sortOrder` | number | Không | ≥ 0 |

**Response mẫu:**

```json
{
  "id": "3",
  "question": "Thời gian hoàn thiện một dự án thông thường là bao lâu?",
  "answer": "Tùy thuộc vào quy mô, thông thường từ 6–18 tháng.",
  "viewCount": 128,
  "helpfulCount": 45,
  "status": "active",
  "sortOrder": 0,
  "createdAt": "2026-01-15T00:00:00.000Z",
  "updatedAt": "2026-05-18T10:00:00.000Z"
}
```

---

### 12.2 Public API

| Method | Endpoint | Mô tả |
|---|---|---|
| `GET` | `/api/cms/public/faqs` | Danh sách (chỉ `status=active`) |
| `GET` | `/api/cms/public/faqs/:id` | Chi tiết |
| `POST` | `/api/cms/public/faqs/:id/view` | Tăng lượt xem |
| `POST` | `/api/cms/public/faqs/:id/helpful` | Đánh dấu hữu ích |

> `POST /view` và `POST /helpful` không cần body. Rate limit: **5 request/60 giây/IP**.

---

## 13. Banners

Quản lý banner quảng cáo theo vị trí.

### 13.1 Admin API

**Yêu cầu quyền:** `marketing.manage`

| Method | Endpoint | Mô tả |
|---|---|---|
| `GET` | `/api/cms/admin/banners` | Danh sách |
| `GET` | `/api/cms/admin/banners/:id` | Chi tiết |
| `POST` | `/api/cms/admin/banners` | Tạo mới |
| `PUT` | `/api/cms/admin/banners/:id` | Cập nhật toàn bộ |
| `DELETE` | `/api/cms/admin/banners/:id` | Xóa |

**Query params (GET list admin):**

| Param | Kiểu | Mô tả |
|---|---|---|
| `status` | `BannerStatus` | Lọc theo trạng thái |
| `locationId` | string (numeric) | Lọc theo vị trí |

**Request body (POST/PUT):**

| Field | Kiểu | Bắt buộc | Ràng buộc |
|---|---|---|---|
| `title` | string | Có | Tối đa 255 ký tự |
| `subtitle` | string | Không | Tối đa 500 ký tự |
| `image` | string (URL) | Không | URL http(s) hợp lệ |
| `mobileImage` | string (URL) | Không | URL http(s) — ảnh riêng cho mobile |
| `link` | string (URL) | Không | URL http(s) hợp lệ |
| `linkTarget` | string | Không | `_self` \| `_blank` (mặc định: `_self`) |
| `description` | string | Không | Tối đa 2.000 ký tự |
| `buttonText` | string | Không | Tối đa 100 ký tự |
| `buttonColor` | string | Không | Mã hex, ví dụ: `#FF5733` |
| `textColor` | string | Không | Mã hex |
| `locationId` | number | Có | ID vị trí banner (`banner_locations.id`) |
| `sortOrder` | number | Không | 0–1.000.000 |
| `status` | `BannerStatus` | Không | Mặc định: `active` |
| `startDate` | string (datetime) | Không | ISO 8601 — ngày bắt đầu hiển thị |
| `endDate` | string (datetime) | Không | ISO 8601 — ngày kết thúc |

**Ví dụ:**

```json
POST /api/cms/admin/banners
{
  "title": "Khuyến mãi tháng 5",
  "subtitle": "Giảm 20% cho tất cả dự án mới",
  "image": "https://cdn.example.com/banner-may.jpg",
  "mobileImage": "https://cdn.example.com/banner-may-mobile.jpg",
  "link": "https://example.com/khuyen-mai",
  "linkTarget": "_blank",
  "buttonText": "Tìm hiểu thêm",
  "buttonColor": "#FF5733",
  "textColor": "#FFFFFF",
  "locationId": 2,
  "startDate": "2026-05-01T00:00:00.000Z",
  "endDate": "2026-05-31T23:59:59.000Z",
  "status": "active"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "20",
    "title": "Khuyến mãi tháng 5",
    "subtitle": "Giảm 20% cho tất cả dự án mới",
    "image": "https://cdn.example.com/banner-may.jpg",
    "mobileImage": "https://cdn.example.com/banner-may-mobile.jpg",
    "link": "https://example.com/khuyen-mai",
    "linkTarget": "_blank",
    "description": null,
    "buttonText": "Tìm hiểu thêm",
    "buttonColor": "#FF5733",
    "textColor": "#FFFFFF",
    "locationId": "2",
    "sortOrder": 0,
    "status": "active",
    "startDate": "2026-05-01T00:00:00.000Z",
    "endDate": "2026-05-31T23:59:59.000Z",
    "createdAt": "2026-05-18T10:00:00.000Z",
    "updatedAt": "2026-05-18T10:00:00.000Z"
  },
  "timestamp": "2026-05-18T10:00:00.000Z"
}
```

---

### 13.2 Public API

| Method | Endpoint | Mô tả |
|---|---|---|
| `GET` | `/api/cms/public/banners` | Danh sách banner đang active |

**Query params (GET list public):**

| Param | Kiểu | Mô tả |
|---|---|---|
| `locationId` | string (numeric) | Lọc theo ID vị trí |
| `locationCode` | string | Lọc theo code vị trí (ví dụ: `homepage_top`) |

> Server tự lọc theo `status=active` và lọc theo `startDate`/`endDate` so với thời điểm hiện tại.

---

## 14. Banner Locations

Quản lý các vị trí đặt banner (homepage top, sidebar, footer…).

### 14.1 Admin API

**Yêu cầu quyền:** `marketing.manage`

| Method | Endpoint | Mô tả |
|---|---|---|
| `GET` | `/api/cms/admin/banner-locations` | Danh sách |
| `GET` | `/api/cms/admin/banner-locations/:id` | Chi tiết |
| `POST` | `/api/cms/admin/banner-locations` | Tạo mới |
| `PUT` | `/api/cms/admin/banner-locations/:id` | Cập nhật toàn bộ |
| `DELETE` | `/api/cms/admin/banner-locations/:id` | Xóa (cascade xóa banner trong vị trí) |
| `PATCH` | `/api/cms/admin/banner-locations/:id/status` | Đổi trạng thái nhanh |

**Query params (GET list admin):**

| Param | Kiểu | Mô tả |
|---|---|---|
| `status` | `BannerStatus` | Lọc theo trạng thái |

**Request body (POST/PUT):**

| Field | Kiểu | Bắt buộc | Ràng buộc |
|---|---|---|---|
| `code` | string | Có | Chỉ `[a-z0-9_-]`, 2–100 ký tự. **Unique.** Dùng để query banner ở FE |
| `name` | string | Có | 1–255 ký tự |
| `description` | string | Không | Tối đa 2.000 ký tự |
| `status` | `BannerStatus` | Không | Mặc định: `active` |

**Request body (PATCH /status):**

```json
{ "status": "inactive" }
```

**Ví dụ tạo vị trí:**

```json
POST /api/cms/admin/banner-locations
{
  "code": "homepage_top",
  "name": "Banner đầu trang chủ",
  "description": "Vị trí slider lớn, kích thước 1920x600px",
  "status": "active"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "2",
    "code": "homepage_top",
    "name": "Banner đầu trang chủ",
    "description": "Vị trí slider lớn, kích thước 1920x600px",
    "status": "active",
    "createdAt": "2026-05-18T10:00:00.000Z",
    "updatedAt": "2026-05-18T10:00:00.000Z"
  },
  "timestamp": "2026-05-18T10:00:00.000Z"
}
```

> **Lưu ý FE:** Để lấy banner theo vị trí, dùng `locationCode` (ví dụ `homepage_top`) thay vì `locationId` để tránh hardcode ID DB.

---

## 15. Contacts

Quản lý form liên hệ từ website.

### 15.1 Public API — Gửi liên hệ

```
POST /api/cms/public/contacts
```

> Rate limit: **3 request/60 giây/IP**.

**Request body:**

| Field | Kiểu | Bắt buộc | Ràng buộc |
|---|---|---|---|
| `name` | string | Có | 1–255 ký tự (trim tự động) |
| `email` | string | Có | Email hợp lệ, tối đa 255 ký tự (lowercase tự động) |
| `phone` | string | Không | Pattern: `+?[0-9 .-]{6,50}` |
| `message` | string | Có | 1–5.000 ký tự |

**Ví dụ:**

```json
POST /api/cms/public/contacts
{
  "name": "Nguyễn Văn C",
  "email": "nguyenvanc@gmail.com",
  "phone": "+84 912 345 678",
  "message": "Tôi muốn tư vấn về dự án tòa nhà văn phòng 10 tầng tại TP.HCM."
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "50",
    "name": "Nguyễn Văn C",
    "email": "nguyenvanc@gmail.com",
    "phone": "+84 912 345 678",
    "message": "Tôi muốn tư vấn...",
    "status": "Pending",
    "createdAt": "2026-05-18T10:00:00.000Z"
  },
  "timestamp": "2026-05-18T10:00:00.000Z"
}
```

> Sau khi tạo, hệ thống tự động gửi Kafka event `contact.submitted` → Notification Service xử lý gửi email thông báo tới admin.

---

### 15.2 Admin API

**Yêu cầu quyền:** `marketing.manage`

| Method | Endpoint | Mô tả |
|---|---|---|
| `GET` | `/api/cms/admin/contacts` | Danh sách |
| `GET` | `/api/cms/admin/contacts/:id` | Chi tiết |
| `PATCH` | `/api/cms/admin/contacts/:id/reply` | Trả lời liên hệ |
| `PATCH` | `/api/cms/admin/contacts/:id/read` | Đánh dấu đã đọc |
| `PATCH` | `/api/cms/admin/contacts/:id/close` | Đóng liên hệ |

**Query params (GET list admin):**

| Param | Kiểu | Mô tả |
|---|---|---|
| `status` | `ContactStatus` | `Pending` \| `Read` \| `Replied` \| `Closed` |
| `email` | string | Tìm theo email |

**Request body (PATCH /reply):**

| Field | Kiểu | Bắt buộc | Ràng buộc |
|---|---|---|---|
| `reply` | string | Có | 1–20.000 ký tự |

**Ví dụ trả lời:**

```json
PATCH /api/cms/admin/contacts/50/reply
{
  "reply": "Kính gửi anh/chị Nguyễn Văn C, chúng tôi đã nhận được yêu cầu tư vấn và sẽ liên hệ lại trong vòng 24 giờ làm việc."
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "50",
    "name": "Nguyễn Văn C",
    "email": "nguyenvanc@gmail.com",
    "phone": "+84 912 345 678",
    "message": "Tôi muốn tư vấn...",
    "status": "Replied",
    "reply": "Kính gửi anh/chị...",
    "repliedAt": "2026-05-18T10:30:00.000Z",
    "createdAt": "2026-05-18T10:00:00.000Z",
    "updatedAt": "2026-05-18T10:30:00.000Z"
  },
  "timestamp": "2026-05-18T10:30:00.000Z"
}
```

---

## Phụ lục: Bảng tóm tắt endpoint

### Endpoint công khai (không cần auth)

| Method | Endpoint | Mô tả |
|---|---|---|
| `GET` | `/api/cms/public/about-sections` | Danh sách giới thiệu |
| `GET` | `/api/cms/public/about-sections/:slug` | Chi tiết giới thiệu |
| `GET` | `/api/cms/public/staff` | Danh sách nhân sự |
| `GET` | `/api/cms/public/staff/:id` | Chi tiết nhân sự |
| `GET` | `/api/cms/public/projects` | Danh sách dự án |
| `GET` | `/api/cms/public/projects/:slug` | Chi tiết dự án |
| `GET` | `/api/cms/public/testimonials` | Danh sách đánh giá |
| `GET` | `/api/cms/public/testimonials/:id` | Chi tiết đánh giá |
| `GET` | `/api/cms/public/partners` | Danh sách đối tác |
| `GET` | `/api/cms/public/partners/:id` | Chi tiết đối tác |
| `GET` | `/api/cms/public/galleries` | Danh sách album ảnh |
| `GET` | `/api/cms/public/galleries/:slug` | Chi tiết album ảnh |
| `GET` | `/api/cms/public/certificates` | Danh sách chứng chỉ |
| `GET` | `/api/cms/public/certificates/:id` | Chi tiết chứng chỉ |
| `GET` | `/api/cms/public/faqs` | Danh sách FAQ |
| `GET` | `/api/cms/public/faqs/:id` | Chi tiết FAQ |
| `POST` | `/api/cms/public/faqs/:id/view` | Tăng lượt xem FAQ |
| `POST` | `/api/cms/public/faqs/:id/helpful` | Đánh dấu FAQ hữu ích |
| `GET` | `/api/cms/public/banners` | Danh sách banner |
| `POST` | `/api/cms/public/contacts` | Gửi form liên hệ |

### Endpoint admin — Quyền `introduction.manage`

| Module | Endpoints |
|---|---|
| About Sections | `GET/POST /admin/about-sections`, `GET/PATCH/DELETE /admin/about-sections/:id` |
| Staff | `GET/POST /admin/staff`, `GET/PATCH/DELETE /admin/staff/:id` |
| Projects | `GET/POST /admin/projects`, `GET/PATCH/DELETE /admin/projects/:id` |
| Testimonials | `GET/POST /admin/testimonials`, `GET/PATCH/DELETE /admin/testimonials/:id` |
| Partners | `GET/POST /admin/partners`, `GET/PATCH/DELETE /admin/partners/:id` |
| Gallery | `GET/POST /admin/galleries`, `GET/PATCH/DELETE /admin/galleries/:id` |
| Certificates | `GET/POST /admin/certificates`, `GET/PATCH/DELETE /admin/certificates/:id` |
| FAQ | `GET/POST /admin/faqs`, `GET/PATCH/DELETE /admin/faqs/:id` |

### Endpoint admin — Quyền `marketing.manage`

| Module | Endpoints |
|---|---|
| Banners | `GET/POST /admin/banners`, `GET/PUT/DELETE /admin/banners/:id` |
| Banner Locations | `GET/POST /admin/banner-locations`, `GET/PUT/DELETE /admin/banner-locations/:id`, `PATCH /admin/banner-locations/:id/status` |
| Contacts | `GET /admin/contacts`, `GET /admin/contacts/:id`, `PATCH /admin/contacts/:id/reply`, `PATCH /admin/contacts/:id/read`, `PATCH /admin/contacts/:id/close` |

---

*Tài liệu sinh ngày 2026-05-18. Liên hệ team backend nếu có thắc mắc.*
