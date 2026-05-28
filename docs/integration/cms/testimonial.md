# CMS Đánh Giá (Testimonial) — Tài Liệu Tích Hợp Admin

> **Service:** cms-service  
> **Permission:** `cms.testimonial.manage`  
> **Base path:** `/admin/testimonials`  
> **Headers:** `Authorization: Bearer <token>`

---

## Enum & Options APIs (Public — không cần auth)

### Lấy danh sách trạng thái

**GET** `/testimonials/enums/statuses`

```json
[
  { "id": "active",   "name": "Hoạt động" },
  { "id": "inactive", "name": "Ngừng hoạt động" },
  { "id": "draft",    "name": "Nháp" }
]
```

### Lấy danh sách dự án (cho dropdown `projectId`)

**GET** `/public/projects/options`

```json
[
  { "id": "1", "name": "Dự án Vinhomes Smart City",  "slug": "du-an-vinhomes-smart-city" },
  { "id": "2", "name": "Dự án Masteri Centre Point", "slug": "du-an-masteri-centre-point" }
]
```

> Dùng `id` làm value cho `projectId`, hiển thị `name` làm label.

---

## Admin CRUD (`/admin/testimonials`)

### 1. Danh Sách

**GET** `/admin/testimonials`

| Tham số     | Kiểu    | Mô tả                                                       |
|-------------|---------|-------------------------------------------------------------|
| `page`      | number  | Trang hiện tại (mặc định: `1`)                              |
| `limit`     | number  | Số item/trang (mặc định: `10`)                              |
| `search`    | string  | Tìm theo `clientName` hoặc `content`                        |
| `status`    | string  | Lọc theo `/testimonials/enums/statuses`                     |
| `featured`  | string  | `"true"` / `"false"` — lọc nổi bật                          |
| `projectId` | string  | Lọc theo ID dự án, dạng numeric string, VD: `"1"`           |
| `skipCount` | boolean | `"true"` bỏ qua đếm tổng                                    |

#### Response

```json
{
  "success": true,
  "data": [
    {
      "id": "1",
      "clientName": "Nguyễn Văn A",
      "clientPosition": "Giám đốc",
      "clientCompany": "Công ty XYZ",
      "clientAvatar": "https://cdn.example.com/avatar.jpg",
      "content": "Dịch vụ rất chuyên nghiệp và tận tâm",
      "rating": 5,
      "projectId": "1",
      "featured": true,
      "status": "active",
      "sortOrder": 0,
      "project": {
        "id": "1",
        "name": "Dự án Vinhomes Smart City",
        "slug": "du-an-vinhomes-smart-city"
      },
      "createdAt": "2025-01-01T00:00:00.000Z",
      "updatedAt": "2025-01-01T00:00:00.000Z"
    }
  ],
  "meta": { "page": 1, "limit": 10, "total": 50, "totalPages": 5 }
}
```

### 2. Chi Tiết

**GET** `/admin/testimonials/:id`

### 3. Tạo

**POST** `/admin/testimonials`

| Trường            | Kiểu    | Bắt buộc | Mô tả                                                           |
|-------------------|---------|----------|-----------------------------------------------------------------|
| `clientName`      | string  | **Có**   | Tên khách hàng (max 255 ký tự)                                  |
| `content`         | string  | **Có**   | Nội dung đánh giá (max 5000 ký tự)                              |
| `clientPosition`  | string  | Không    | Chức vụ (max 255 ký tự)                                         |
| `clientCompany`   | string  | Không    | Công ty (max 255 ký tự)                                         |
| `clientAvatar`    | string  | Không    | URL ảnh đại diện (max 500 ký tự)                                |
| `rating`          | number  | Không    | Điểm đánh giá **1–5** (mặc định: `5`)                           |
| `projectId`       | number  | Không    | ID dự án — lấy từ `GET /public/projects/options`                |
| `featured`        | boolean | Không    | Đánh giá nổi bật (mặc định: `false`)                            |
| `status`          | string  | Không    | Giá trị từ `/testimonials/enums/statuses` (mặc định: `active`)  |
| `sortOrder`       | number  | Không    | Thứ tự hiển thị, min `0` (mặc định: `0`)                       |

### 4. Cập Nhật

**PUT** `/admin/testimonials/:id` — Body giống Tạo, tất cả trường tuỳ chọn.

### 5. Xóa

**DELETE** `/admin/testimonials/:id` → `{ "success": true }`

---

## Ghi Chú

| Điểm        | Chi tiết                                                                     |
|-------------|------------------------------------------------------------------------------|
| `id`        | String (BigInt serialized)                                                   |
| `projectId` | Tuỳ chọn. Nếu project bị xóa, `projectId` tự động set về `null` (SetNull)   |
| `rating`    | Integer từ 1 đến 5                                                           |
| Sort        | `sortOrder ASC + id ASC`                                                     |
