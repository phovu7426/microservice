# CMS Chứng Chỉ (Certificate) — Tài Liệu Tích Hợp Admin

> **Service:** cms-service  
> **Permission:** `cms.certificate.manage`  
> **Base path:** `/admin/certificates`  
> **Headers:** `Authorization: Bearer <token>`

---

## Enum & Options APIs (Public — không cần auth)

### Lấy loại chứng chỉ

**GET** `/certificates/enums/types`

```json
[
  { "id": "iso",         "name": "ISO" },
  { "id": "quality",     "name": "Chất lượng" },
  { "id": "safety",      "name": "An toàn" },
  { "id": "environment", "name": "Môi trường" },
  { "id": "other",       "name": "Khác" }
]
```

### Lấy danh sách trạng thái

**GET** `/certificates/enums/statuses`

```json
[
  { "id": "active",   "name": "Hoạt động" },
  { "id": "inactive", "name": "Ngừng hoạt động" },
  { "id": "draft",    "name": "Nháp" }
]
```

---

## Admin CRUD (`/admin/certificates`)

### 1. Danh Sách

**GET** `/admin/certificates`

| Tham số     | Kiểu    | Mô tả                                        |
|-------------|---------|----------------------------------------------|
| `page`      | number  | Trang hiện tại (mặc định: `1`)               |
| `limit`     | number  | Số item/trang (mặc định: `10`)               |
| `search`    | string  | Tìm theo `name`                              |
| `status`    | string  | Lọc theo `/certificates/enums/statuses`      |
| `type`      | string  | Lọc theo `/certificates/enums/types`         |
| `skipCount` | boolean | `"true"` bỏ qua đếm tổng                     |

### 2. Chi Tiết

**GET** `/admin/certificates/:id`

### 3. Tạo

**POST** `/admin/certificates`

| Trường                | Kiểu   | Bắt buộc | Mô tả                                                  |
|-----------------------|--------|----------|--------------------------------------------------------|
| `name`                | string | **Có**   | Tên chứng chỉ (max 255 ký tự)                          |
| `image`               | string | Không    | URL ảnh chứng chỉ (max 500 ký tự)                      |
| `issuedBy`            | string | Không    | Đơn vị cấp (max 255 ký tự)                             |
| `issuedDate`          | string | Không    | Ngày cấp, ISO date: `"2024-01-15"`                     |
| `expiryDate`          | string | Không    | Ngày hết hạn, ISO date: `"2027-01-15"`                 |
| `certificateNumber`   | string | Không    | Số chứng chỉ (max 255 ký tự)                           |
| `description`         | string | Không    | Mô tả (max 5000 ký tự)                                 |
| `type`                | string | Không    | Giá trị từ `/certificates/enums/types`                 |
| `status`              | string | Không    | Giá trị từ `/certificates/enums/statuses` (mặc định: `active`) |
| `sortOrder`           | number | Không    | Thứ tự hiển thị, min `0` (mặc định: `0`)              |

### 4. Cập Nhật

**PUT** `/admin/certificates/:id` — Body giống Tạo, tất cả trường tuỳ chọn.

### 5. Xóa

**DELETE** `/admin/certificates/:id` → `{ "success": true }`

---

## Ghi Chú

| Điểm                  | Chi tiết                                     |
|-----------------------|----------------------------------------------|
| `id`                  | String (BigInt serialized)                   |
| `issuedDate`/`expiryDate` | Kiểu Date, format `YYYY-MM-DD`           |
| Sort mặc định         | `sortOrder ASC + id ASC`                     |
