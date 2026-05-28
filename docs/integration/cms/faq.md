# CMS Câu Hỏi Thường Gặp (FAQ) — Tài Liệu Tích Hợp Admin

> **Service:** cms-service  
> **Permission:** `cms.faq.manage`  
> **Base path:** `/admin/faqs`  
> **Headers:** `Authorization: Bearer <token>`

---

## Enum & Options APIs (Public — không cần auth)

### Lấy danh sách trạng thái

**GET** `/faqs/enums/statuses`

```json
[
  { "id": "active",   "name": "Hoạt động" },
  { "id": "inactive", "name": "Ngừng hoạt động" },
  { "id": "draft",    "name": "Nháp" }
]
```

---

## Admin CRUD (`/admin/faqs`)

### 1. Danh Sách

**GET** `/admin/faqs`

| Tham số     | Kiểu    | Mô tả                                  |
|-------------|---------|----------------------------------------|
| `page`      | number  | Trang hiện tại (mặc định: `1`)         |
| `limit`     | number  | Số item/trang (mặc định: `10`)         |
| `search`    | string  | Tìm theo `question` hoặc `answer`      |
| `status`    | string  | Lọc theo `/faqs/enums/statuses`        |
| `skipCount` | boolean | `"true"` bỏ qua đếm tổng               |

#### Response

```json
{
  "success": true,
  "data": [
    {
      "id": "1",
      "question": "Dịch vụ của bạn bao gồm những gì?",
      "answer": "Chúng tôi cung cấp...",
      "viewCount": 120,
      "helpfulCount": 45,
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

**GET** `/admin/faqs/:id`

### 3. Tạo

**POST** `/admin/faqs`

| Trường      | Kiểu   | Bắt buộc | Mô tả                                                   |
|-------------|--------|----------|---------------------------------------------------------|
| `question`  | string | **Có**   | Câu hỏi (max 500 ký tự)                                 |
| `answer`    | string | **Có**   | Câu trả lời, hỗ trợ HTML (max 20.000 ký tự)             |
| `status`    | string | Không    | Giá trị từ `/faqs/enums/statuses` (mặc định: `active`)  |
| `sortOrder` | number | Không    | Thứ tự hiển thị, min `0` (mặc định: `0`)               |

### 4. Cập Nhật

**PUT** `/admin/faqs/:id` — Body giống Tạo, tất cả trường tuỳ chọn.

### 5. Xóa

**DELETE** `/admin/faqs/:id` → `{ "success": true }`

---

## Ghi Chú

| Điểm          | Chi tiết                                                      |
|---------------|---------------------------------------------------------------|
| `id`          | String (BigInt serialized)                                    |
| `viewCount`   | Tự động tăng khi public user xem — admin không ghi đè        |
| `helpfulCount`| Tự động tăng khi public user đánh giá hữu ích                |
| Sort mặc định | `sortOrder ASC + id ASC`                                      |
