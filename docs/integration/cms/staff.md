# CMS Nhân Sự (Staff) — Tài Liệu Tích Hợp Admin

> **Service:** cms-service  
> **Permission:** `cms.staff.manage`  
> **Base path:** `/admin/staff`  
> **Headers:** `Authorization: Bearer <token>`

---

## Enum & Options APIs (Public — không cần auth)

### Lấy danh sách trạng thái

**GET** `/staff/enums/statuses`

```json
[
  { "id": "active",   "name": "Hoạt động" },
  { "id": "inactive", "name": "Ngừng hoạt động" },
  { "id": "draft",    "name": "Nháp" }
]
```

---

## Admin CRUD (`/admin/staff`)

### 1. Danh Sách

**GET** `/admin/staff`

| Tham số      | Kiểu    | Mô tả                                       |
|--------------|---------|---------------------------------------------|
| `page`       | number  | Trang hiện tại (mặc định: `1`)              |
| `limit`      | number  | Số item/trang (mặc định: `10`)              |
| `search`     | string  | Tìm theo `name`                             |
| `status`     | string  | Lọc theo `/staff/enums/statuses`            |
| `department` | string  | Lọc theo phòng ban (khớp chính xác)         |
| `skipCount`  | boolean | `"true"` bỏ qua đếm tổng                    |

#### Response

```json
{
  "success": true,
  "data": [
    {
      "id": "1",
      "name": "Nguyễn Văn A",
      "position": "Giám đốc điều hành",
      "department": "Ban lãnh đạo",
      "bio": "Hơn 20 năm kinh nghiệm...",
      "avatar": "https://cdn.example.com/avatar.jpg",
      "email": "a@example.com",
      "phone": "0901234567",
      "socialLinks": {
        "linkedin": "https://linkedin.com/in/a",
        "facebook": "https://facebook.com/a"
      },
      "experience": "20 năm trong ngành xây dựng",
      "expertise": "Quản lý dự án, BIM",
      "status": "active",
      "sortOrder": 0,
      "createdAt": "2025-01-01T00:00:00.000Z",
      "updatedAt": "2025-01-01T00:00:00.000Z"
    }
  ],
  "meta": { "page": 1, "limit": 10, "total": 20, "totalPages": 2 }
}
```

### 2. Chi Tiết

**GET** `/admin/staff/:id`

### 3. Tạo

**POST** `/admin/staff`

| Trường        | Kiểu   | Bắt buộc | Mô tả                                                     |
|---------------|--------|----------|-----------------------------------------------------------|
| `name`        | string | **Có**   | Họ tên (max 255 ký tự)                                    |
| `position`    | string | Không    | Chức vụ (max 255 ký tự)                                   |
| `department`  | string | Không    | Phòng ban (max 255 ký tự)                                 |
| `bio`         | string | Không    | Tiểu sử ngắn (max 5000 ký tự)                             |
| `avatar`      | string | Không    | URL ảnh đại diện (max 500 ký tự)                          |
| `email`       | string | Không    | Email hợp lệ (max 255 ký tự)                              |
| `phone`       | string | Không    | Số điện thoại, format `+?[0-9 .-]{6,50}` (max 50 ký tự)  |
| `socialLinks` | object | Không    | Map platform → URL, xem [Cấu trúc socialLinks](#cấu-trúc-sociallinks) |
| `experience`  | string | Không    | Mô tả kinh nghiệm (max 5000 ký tự)                        |
| `expertise`   | string | Không    | Lĩnh vực chuyên môn (max 5000 ký tự)                      |
| `status`      | string | Không    | Giá trị từ `/staff/enums/statuses` (mặc định: `active`)   |
| `sortOrder`   | number | Không    | Thứ tự hiển thị, min `0` (mặc định: `0`)                 |

### 4. Cập Nhật

**PUT** `/admin/staff/:id` — Body giống Tạo, tất cả trường tuỳ chọn.

### 5. Xóa

**DELETE** `/admin/staff/:id` → `{ "success": true }`

---

## Cấu Trúc `socialLinks`

Object dạng `{ platform: url }`. Key tự do, value là URL.

```json
{
  "socialLinks": {
    "linkedin":  "https://linkedin.com/in/username",
    "facebook":  "https://facebook.com/username",
    "twitter":   "https://twitter.com/username",
    "youtube":   "https://youtube.com/@channel"
  }
}
```

> Gửi `{}` để xóa toàn bộ social links.  
> FE phải validate giá trị là URL http/https trước khi render thành `<a href>`.

---

## Ghi Chú

| Điểm     | Chi tiết                                            |
|----------|-----------------------------------------------------|
| `id`     | String (BigInt serialized)                          |
| Sort     | `sortOrder ASC + id ASC`                            |
| `phone`  | Format: tùy chọn `+`, theo sau là chữ số/dấu cách/chấm/gạch |
