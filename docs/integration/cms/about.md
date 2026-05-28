# CMS Giới Thiệu (About Sections) — Tài Liệu Tích Hợp Admin

> **Service:** cms-service  
> **Permission:** `cms.about.manage`  
> **Base path:** `/admin/about-sections`  
> **Headers:** `Authorization: Bearer <token>`

---

## Enum & Options APIs (Public — không cần auth)

### Lấy loại section

**GET** `/about/enums/types`

```json
[
  { "id": "general", "name": "Tổng quan" },
  { "id": "mission", "name": "Sứ mệnh" },
  { "id": "vision",  "name": "Tầm nhìn" },
  { "id": "history", "name": "Lịch sử" },
  { "id": "values",  "name": "Giá trị" }
]
```

### Lấy danh sách trạng thái

**GET** `/about/enums/statuses`

```json
[
  { "id": "active",   "name": "Hoạt động" },
  { "id": "inactive", "name": "Ngừng hoạt động" },
  { "id": "draft",    "name": "Nháp" }
]
```

---

## Admin CRUD (`/admin/about-sections`)

### 1. Danh Sách

**GET** `/admin/about-sections`

| Tham số       | Kiểu    | Mô tả                                              |
|---------------|---------|----------------------------------------------------|
| `page`        | number  | Trang hiện tại (mặc định: `1`)                     |
| `limit`       | number  | Số item/trang (mặc định: `10`)                     |
| `search`      | string  | Tìm theo `title`                                   |
| `status`      | string  | Lọc theo `/about/enums/statuses`                   |
| `sectionType` | string  | Lọc theo `/about/enums/types`                      |
| `skipCount`   | boolean | `"true"` bỏ qua đếm tổng                           |

### 2. Chi Tiết

**GET** `/admin/about-sections/:id`

### 3. Tạo

**POST** `/admin/about-sections`

| Trường        | Kiểu   | Bắt buộc | Mô tả                                                      |
|---------------|--------|----------|------------------------------------------------------------|
| `title`       | string | **Có**   | Tiêu đề (max 255 ký tự)                                    |
| `slug`        | string | Không    | Tự động sinh từ `title` nếu bỏ trống                       |
| `content`     | string | Không    | Nội dung HTML (max 20.000 ký tự)                           |
| `image`       | string | Không    | URL ảnh (max 500 ký tự)                                    |
| `videoUrl`    | string | Không    | URL video, **bắt buộc http/https** (max 500 ký tự)         |
| `sectionType` | string | Không    | Giá trị từ `/about/enums/types` (mặc định: `general`)      |
| `status`      | string | Không    | Giá trị từ `/about/enums/statuses` (mặc định: `active`)    |
| `sortOrder`   | number | Không    | Thứ tự hiển thị, min `0` (mặc định: `0`)                  |

### 4. Cập Nhật

**PUT** `/admin/about-sections/:id` — Body giống Tạo, tất cả trường tuỳ chọn.

### 5. Xóa

**DELETE** `/admin/about-sections/:id` → `{ "success": true }`

---

## Ghi Chú

| Điểm       | Chi tiết                                              |
|------------|-------------------------------------------------------|
| `id`       | String (BigInt serialized)                            |
| `slug`     | Tự sinh từ `title`, unique, thêm suffix số nếu trùng  |
| `videoUrl` | Phải là http/https — không chấp nhận `javascript:`   |
