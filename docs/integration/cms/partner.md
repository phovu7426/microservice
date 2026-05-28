# CMS Đối Tác (Partner) — Tài Liệu Tích Hợp Admin

> **Service:** cms-service  
> **Permission:** `cms.partner.manage`  
> **Base path:** `/admin/partners`  
> **Headers:** `Authorization: Bearer <token>`

---

## Enum & Options APIs (Public — không cần auth)

### Lấy danh sách trạng thái

**GET** `/partners/enums/statuses`

```json
[
  { "id": "active",   "name": "Hoạt động" },
  { "id": "inactive", "name": "Ngừng hoạt động" },
  { "id": "draft",    "name": "Nháp" }
]
```

> **Lưu ý:** Trường `type` của Partner là chuỗi tự do (không phải enum), FE tự định nghĩa danh sách loại nếu cần.

---

## Admin CRUD (`/admin/partners`)

### 1. Danh Sách

**GET** `/admin/partners`

| Tham số     | Kiểu    | Mô tả                                              |
|-------------|---------|---------------------------------------------------|
| `page`      | number  | Trang hiện tại (mặc định: `1`)                    |
| `limit`     | number  | Số item/trang (mặc định: `10`)                    |
| `search`    | string  | Tìm theo `name`                                   |
| `status`    | string  | Lọc theo `/partners/enums/statuses`               |
| `type`      | string  | Lọc theo giá trị `type` tự do (VD: `"strategic"`) |
| `skipCount` | boolean | `"true"` bỏ qua đếm tổng                          |

#### Response

```json
{
  "success": true,
  "data": [
    {
      "id": "1",
      "name": "Công ty ABC",
      "logo": "https://cdn.example.com/logo.png",
      "website": "https://abc.com",
      "description": "Đối tác chiến lược",
      "type": "strategic",
      "status": "active",
      "sortOrder": 0,
      "createdAt": "2025-01-01T00:00:00.000Z",
      "updatedAt": "2025-01-01T00:00:00.000Z"
    }
  ],
  "meta": { "page": 1, "limit": 10, "total": 30, "totalPages": 3 }
}
```

### 2. Chi Tiết

**GET** `/admin/partners/:id`

### 3. Tạo

**POST** `/admin/partners`

| Trường        | Kiểu   | Bắt buộc | Mô tả                                                       |
|---------------|--------|----------|-------------------------------------------------------------|
| `name`        | string | **Có**   | Tên đối tác (max 255 ký tự)                                 |
| `logo`        | string | Không    | URL logo (max 500 ký tự)                                    |
| `website`     | string | Không    | URL website, **bắt buộc http/https** (max 500 ký tự)        |
| `description` | string | Không    | Mô tả (max 2000 ký tự)                                      |
| `type`        | string | Không    | Loại đối tác, chuỗi tự do `a-z0-9_-` (max 50 ký tự)        |
| `status`      | string | Không    | Giá trị từ `/partners/enums/statuses` (mặc định: `active`)  |
| `sortOrder`   | number | Không    | Thứ tự hiển thị, min `0` (mặc định: `0`)                   |

**Validation `type`:** Chỉ chấp nhận `a-z`, `A-Z`, `0-9`, `_`, `-`. Ví dụ: `strategic`, `technology`, `media`.

### 4. Cập Nhật

**PUT** `/admin/partners/:id` — Body giống Tạo, tất cả trường tuỳ chọn.

### 5. Xóa

**DELETE** `/admin/partners/:id` → `{ "success": true }`

---

## Ghi Chú

| Điểm      | Chi tiết                                                          |
|-----------|-------------------------------------------------------------------|
| `id`      | String (BigInt serialized)                                        |
| `website` | Phải là http/https — không chấp nhận `javascript:`               |
| `type`    | Chuỗi tự do, không phải enum — FE tự quản lý danh sách nếu cần  |
| Sort      | `sortOrder ASC + id ASC`                                          |
