# CMS Dự Án (Project) — Tài Liệu Tích Hợp Admin

> **Service:** cms-service  
> **Permission CRUD:** `cms.project.manage`  
> **Headers:** `Authorization: Bearer <token>`

---

## Enum & Options APIs (Public — không cần auth)

### Lấy danh sách trạng thái dự án

**GET** `/projects/enums/statuses`

```json
[
  { "id": "planning",    "name": "Lên kế hoạch" },
  { "id": "in_progress", "name": "Đang thực hiện" },
  { "id": "completed",   "name": "Hoàn thành" },
  { "id": "cancelled",   "name": "Đã hủy" }
]
```

### Lấy danh sách dự án cho dropdown (dùng trong form Testimonial)

**GET** `/public/projects/options`

```json
[
  { "id": "1", "name": "Dự án Vinhomes Smart City",  "slug": "du-an-vinhomes-smart-city" },
  { "id": "2", "name": "Dự án Masteri Centre Point", "slug": "du-an-masteri-centre-point" }
]
```

> Dùng `id` làm value cho `projectId`, hiển thị `name` làm label.

---

## Admin CRUD (`/admin/projects`)

### 1. Danh Sách Dự Án

**GET** `/admin/projects`

#### Query Parameters

| Tham số     | Kiểu    | Mô tả                                                               |
|-------------|---------|---------------------------------------------------------------------|
| `page`      | number  | Trang hiện tại (mặc định: `1`)                                      |
| `limit`     | number  | Số item/trang (mặc định: `10`)                                      |
| `search`    | string  | Tìm theo `name`, `slug`, hoặc `clientName`                          |
| `status`    | string  | Lọc theo giá trị từ `/projects/enums/statuses`                      |
| `featured`  | string  | `"true"` hoặc `"false"` — lọc dự án nổi bật                        |
| `skipCount` | boolean | `"true"` để bỏ qua đếm tổng                                         |

> Sort mặc định: `sortOrder ASC + id ASC`.

#### Response

```json
{
  "success": true,
  "data": [
    {
      "id": "1",
      "name": "Dự án Vinhomes Smart City",
      "slug": "du-an-vinhomes-smart-city",
      "shortDescription": "Khu đô thị thông minh tại Hà Nội",
      "coverImage": "https://cdn.example.com/cover.jpg",
      "location": "Hà Nội",
      "area": 280.5,
      "startDate": "2022-01-01",
      "endDate": "2025-12-31",
      "status": "in_progress",
      "clientName": "Vinhomes",
      "budget": 5000000,
      "featured": true,
      "viewCount": 1200,
      "sortOrder": 1,
      "metaTitle": "...",
      "metaDescription": "...",
      "canonicalUrl": "...",
      "ogImage": "...",
      "createdAt": "2025-01-01T00:00:00.000Z",
      "updatedAt": "2025-01-01T00:00:00.000Z"
    }
  ],
  "meta": { "page": 1, "limit": 10, "total": 30, "totalPages": 3 }
}
```

> Danh sách **không** trả về `description` và `images` — lấy qua `GET /admin/projects/:id`.

### 2. Chi Tiết Dự Án

**GET** `/admin/projects/:id`

Trả về object đầy đủ, **kèm mảng `testimonials`**.

```json
{
  "success": true,
  "data": {
    "id": "1",
    "name": "Dự án Vinhomes Smart City",
    "slug": "du-an-vinhomes-smart-city",
    "description": "<p>Nội dung HTML đầy đủ...</p>",
    "shortDescription": "...",
    "coverImage": "...",
    "images": ["https://cdn.example.com/img1.jpg", "https://cdn.example.com/img2.jpg"],
    "location": "Hà Nội",
    "area": 280.5,
    "startDate": "2022-01-01",
    "endDate": "2025-12-31",
    "status": "in_progress",
    "clientName": "Vinhomes",
    "budget": 5000000,
    "featured": true,
    "viewCount": 1200,
    "sortOrder": 1,
    "metaTitle": "...",
    "metaDescription": "...",
    "canonicalUrl": "...",
    "ogImage": "...",
    "testimonials": [
      { "id": "5", "author": "Nguyễn Văn A", "content": "Dịch vụ tuyệt vời", "rating": 5, "status": "active" }
    ],
    "createdAt": "2025-01-01T00:00:00.000Z",
    "updatedAt": "2025-01-01T00:00:00.000Z"
  }
}
```

### 3. Tạo Dự Án

**POST** `/admin/projects`

#### Thông Tin Cơ Bản

| Trường             | Kiểu    | Bắt buộc | Mô tả                                                              |
|--------------------|---------|----------|--------------------------------------------------------------------|
| `name`             | string  | **Có**   | Tên dự án (max 255 ký tự)                                          |
| `slug`             | string  | Không    | Tự động sinh từ `name` nếu bỏ trống                                |
| `shortDescription` | string  | Không    | Mô tả ngắn (max 500 ký tự)                                         |
| `description`      | string  | Không    | Nội dung đầy đủ, hỗ trợ HTML                                       |
| `coverImage`       | string  | Không    | URL ảnh đại diện (max 500 ký tự)                                   |
| `images`           | array   | Không    | Mảng URL ảnh album (max 200 ảnh)                                   |
| `status`           | string  | Không    | Giá trị từ `/projects/enums/statuses` (mặc định: `planning`)       |
| `featured`         | boolean | Không    | Dự án nổi bật (mặc định: `false`)                                  |
| `sortOrder`        | number  | Không    | Thứ tự hiển thị, min `0` (mặc định: `0`)                          |

#### Thông Tin Dự Án

| Trường       | Kiểu   | Bắt buộc | Mô tả                                              |
|--------------|--------|----------|----------------------------------------------------|
| `location`   | string | Không    | Địa điểm (max 255 ký tự)                           |
| `area`       | number | Không    | Diện tích m² (số thực)                             |
| `clientName` | string | Không    | Chủ đầu tư / khách hàng (max 255 ký tự)            |
| `budget`     | number | Không    | Ngân sách (số thực)                                |
| `startDate`  | string | Không    | ISO date: `"2025-01-15"`                           |
| `endDate`    | string | Không    | ISO date: `"2025-12-31"`                           |

#### SEO

| Trường            | Kiểu   | Mô tả                               |
|-------------------|--------|-------------------------------------|
| `metaTitle`       | string | Max 255 ký tự                       |
| `metaDescription` | string | Max 500 ký tự                       |
| `canonicalUrl`    | string | Max 500 ký tự                       |
| `ogImage`         | string | Max 500 ký tự                       |

**Lưu ý slug:** Bỏ trống → tự sinh từ `name`. Trùng → tự thêm suffix số. Truyền thủ công → kiểm tra trùng, trả 400 nếu đã tồn tại.

### 4. Cập Nhật Dự Án

**PUT** `/admin/projects/:id` — Body giống Tạo, tất cả trường tuỳ chọn.

| Điều kiện                          | Kết quả slug                   |
|------------------------------------|--------------------------------|
| Truyền `slug` mới                  | Dùng slug mới (kiểm tra trùng) |
| Truyền `name` mới, không có `slug` | Tự sinh slug mới từ `name`     |
| Chỉ cập nhật trường khác           | Slug giữ nguyên                |

### 5. Xóa Dự Án

**DELETE** `/admin/projects/:id` → `{ "success": true }`

---

## Cấu Trúc `images`

```json
{ "images": ["https://cdn.example.com/img1.jpg", "https://cdn.example.com/img2.jpg"] }
```

- Tối đa **200 URL**. Gửi `[]` để xóa toàn bộ.
- Chỉ có trong response `GET /admin/projects/:id`, **không có trong danh sách**.

---

## Ghi Chú

| Điểm                  | Chi tiết                                                             |
|-----------------------|----------------------------------------------------------------------|
| Kiểu `id`             | String (BigInt serialized)                                           |
| `startDate`/`endDate` | Kiểu Date không có giờ, format `YYYY-MM-DD`                         |
| `viewCount`           | Tự động tăng bởi public API — admin không ghi đè                    |
| `testimonials`        | Chỉ có ở chi tiết `GET /admin/projects/:id`                          |
| `budget` / `area`     | Số thực (`float`), không có đơn vị — FE tự format khi hiển thị      |
