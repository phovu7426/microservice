# CMS Thư Viện Ảnh (Gallery) — Tài Liệu Tích Hợp Admin

> **Service:** cms-service  
> **Permission:** `cms.gallery.manage`  
> **Base path:** `/admin/galleries`  
> **Headers:** `Authorization: Bearer <token>`

---

## Enum & Options APIs (Public — không cần auth)

### Lấy danh sách trạng thái

**GET** `/galleries/enums/statuses`

```json
[
  { "id": "active",   "name": "Hoạt động" },
  { "id": "inactive", "name": "Ngừng hoạt động" },
  { "id": "draft",    "name": "Nháp" }
]
```

---

## Admin CRUD (`/admin/galleries`)

### 1. Danh Sách

**GET** `/admin/galleries`

| Tham số     | Kiểu    | Mô tả                                     |
|-------------|---------|-------------------------------------------|
| `page`      | number  | Trang hiện tại (mặc định: `1`)            |
| `limit`     | number  | Số item/trang (mặc định: `10`)            |
| `search`    | string  | Tìm theo `title`                          |
| `status`    | string  | Lọc theo `/galleries/enums/statuses`      |
| `featured`  | string  | `"true"` / `"false"` — lọc nổi bật        |
| `skipCount` | boolean | `"true"` bỏ qua đếm tổng                  |

#### Response

```json
{
  "success": true,
  "data": [
    {
      "id": "1",
      "title": "Công trình 2024",
      "slug": "cong-trinh-2024",
      "description": "Tổng hợp ảnh công trình năm 2024",
      "coverImage": "https://cdn.example.com/cover.jpg",
      "featured": true,
      "status": "active",
      "sortOrder": 0,
      "createdAt": "2025-01-01T00:00:00.000Z",
      "updatedAt": "2025-01-01T00:00:00.000Z"
    }
  ],
  "meta": { "page": 1, "limit": 10, "total": 15, "totalPages": 2 }
}
```

> Danh sách **không** trả về `images` — lấy chi tiết bằng `GET /admin/galleries/:id`.

### 2. Chi Tiết

**GET** `/admin/galleries/:id` — Trả về đầy đủ kèm `images[]`.

### 3. Tạo

**POST** `/admin/galleries`

| Trường        | Kiểu    | Bắt buộc | Mô tả                                                      |
|---------------|---------|----------|------------------------------------------------------------|
| `title`       | string  | **Có**   | Tiêu đề album (max 255 ký tự)                              |
| `slug`        | string  | Không    | Tự động sinh từ `title` nếu bỏ trống                       |
| `description` | string  | Không    | Mô tả (max 5000 ký tự)                                     |
| `coverImage`  | string  | Không    | URL ảnh bìa (max 500 ký tự)                                |
| `images`      | array   | Không    | Mảng URL ảnh (max 200 ảnh), xem [Cấu trúc images](#cấu-trúc-images) |
| `featured`    | boolean | Không    | Album nổi bật (mặc định: `false`)                          |
| `status`      | string  | Không    | Giá trị từ `/galleries/enums/statuses` (mặc định: `active`) |
| `sortOrder`   | number  | Không    | Thứ tự hiển thị, min `0` (mặc định: `0`)                  |

### 4. Cập Nhật

**PUT** `/admin/galleries/:id` — Body giống Tạo, tất cả trường tuỳ chọn.

### 5. Xóa

**DELETE** `/admin/galleries/:id` → `{ "success": true }`

---

## Cấu Trúc `images`

```json
{
  "images": [
    "https://cdn.example.com/gallery/img1.jpg",
    "https://cdn.example.com/gallery/img2.jpg"
  ]
}
```

- Tối đa **200 URL**. Gửi `[]` để xóa toàn bộ.
- `images` chỉ có trong response `GET /admin/galleries/:id`, **không có trong danh sách**.

---

## Ghi Chú

| Điểm     | Chi tiết                                               |
|----------|--------------------------------------------------------|
| `id`     | String (BigInt serialized)                             |
| `slug`   | Tự sinh từ `title`, unique, thêm suffix số nếu trùng   |
| Sort     | `sortOrder ASC + id ASC`                               |
