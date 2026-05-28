# CMS Banner Location — Tài Liệu Tích Hợp Admin

> **Service:** cms-service  
> **Permission CRUD:** `cms.banner_location.manage`  
> **Headers:** `Authorization: Bearer <token>`

Banner Location là các **slot vị trí** trên giao diện. Mỗi location có `code` duy nhất, FE/template dùng `code` để lấy đúng nhóm banner cho từng khu vực (hero, sidebar, popup…).

---

## Enum & Options APIs (Public — không cần auth)

### Lấy danh sách trạng thái

**GET** `/banner-locations/enums/statuses`

```json
[
  { "id": "draft",    "name": "Nháp" },
  { "id": "active",   "name": "Hoạt động" },
  { "id": "inactive", "name": "Ngừng hoạt động" }
]
```

### Lấy danh sách vị trí cho dropdown (dùng trong form Banner)

**GET** `/public/banner-locations/options`

Chỉ trả về location đang `active`, sắp xếp theo tên.

```json
[
  { "id": "1", "name": "Trang chủ - Hero",  "code": "homepage-hero" },
  { "id": "2", "name": "Sidebar phải",      "code": "sidebar-right" }
]
```

---

## Admin CRUD (`/admin/banner-locations`)

### 1. Danh Sách Banner Location

**GET** `/admin/banner-locations`

#### Query Parameters

| Tham số     | Kiểu    | Mô tả                                                          |
|-------------|---------|----------------------------------------------------------------|
| `page`      | number  | Trang hiện tại (mặc định: `1`)                                 |
| `limit`     | number  | Số item/trang (mặc định: `10`)                                 |
| `search`    | string  | Tìm kiếm theo `name` hoặc `code`                               |
| `status`    | string  | Lọc theo giá trị từ `/banner-locations/enums/statuses`         |
| `sort`      | string  | `name:asc` / `code:asc` / `createdAt:desc` / `status:asc`     |
| `skipCount` | boolean | `"true"` để bỏ qua đếm tổng                                    |

#### Response

```json
{
  "success": true,
  "data": [
    {
      "id": "1",
      "code": "homepage-hero",
      "name": "Trang chủ - Hero",
      "description": "Vị trí banner lớn đầu trang chủ",
      "status": "active",
      "createdAt": "2025-01-01T00:00:00.000Z",
      "updatedAt": "2025-01-01T00:00:00.000Z"
    }
  ],
  "meta": { "page": 1, "limit": 10, "total": 5, "totalPages": 1 }
}
```

### 2. Chi Tiết Banner Location

**GET** `/admin/banner-locations/:id`

Trả về object location đầy đủ, **kèm mảng `banners`** thuộc location đó.

```json
{
  "success": true,
  "data": {
    "id": "1",
    "code": "homepage-hero",
    "name": "Trang chủ - Hero",
    "description": "...",
    "status": "active",
    "banners": [
      { "id": "10", "title": "Banner Tết 2025", "status": "active", "sortOrder": 0 }
    ],
    "createdAt": "2025-01-01T00:00:00.000Z",
    "updatedAt": "2025-01-01T00:00:00.000Z"
  }
}
```

### 3. Tạo Banner Location

**POST** `/admin/banner-locations`

| Trường        | Kiểu   | Bắt buộc | Mô tả                                                                      |
|---------------|--------|----------|----------------------------------------------------------------------------|
| `code`        | string | **Có**   | Mã định danh duy nhất, **2–100 ký tự**, chỉ `a-z`, `0-9`, `-`, `_`        |
| `name`        | string | **Có**   | Tên hiển thị (1–255 ký tự)                                                 |
| `description` | string | Không    | Mô tả mục đích vị trí (max 2000 ký tự)                                     |
| `status`      | string | Không    | Giá trị từ `/banner-locations/enums/statuses` (mặc định: `active`)         |

**Quy tắc `code`:** Chỉ `a-z`, `0-9`, `-`, `_`. Duy nhất toàn hệ thống — trả 409 nếu trùng.

### 4. Cập Nhật Banner Location

**PUT** `/admin/banner-locations/:id` — Body giống Tạo, tất cả trường tuỳ chọn.

### 5. Đổi Trạng Thái

**PATCH** `/admin/banner-locations/:id/status`

```json
{ "status": "inactive" }
```

### 6. Xóa Banner Location

**DELETE** `/admin/banner-locations/:id`

> Không thể xóa nếu còn banner. Trả 409: `"Banner location has banners and cannot be deleted"`

---

## Ghi Chú

| Điểm          | Chi tiết                                                                           |
|---------------|------------------------------------------------------------------------------------|
| Kiểu `id`     | String (BigInt serialized)                                                         |
| Sort mặc định | `createdAt DESC`                                                                   |
| `code`        | Public API dùng `code` để lấy banner theo slot — đổi sau go-live sẽ vỡ template  |
| Cascade       | Xóa location cascade xóa toàn bộ banner thuộc nó                                  |
