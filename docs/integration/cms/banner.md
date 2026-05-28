# CMS Banner — Tài Liệu Tích Hợp Admin

> **Service:** cms-service  
> **Permission CRUD:** `cms.banner.manage`  
> **Headers:** `Authorization: Bearer <token>`

---

## Enum & Options APIs (Public — không cần auth)

### Lấy danh sách trạng thái banner

**GET** `/banners/enums/statuses`

```json
[
  { "id": "draft",    "name": "Nháp" },
  { "id": "active",   "name": "Hoạt động" },
  { "id": "inactive", "name": "Ngừng hoạt động" }
]
```

### Lấy danh sách link target

**GET** `/banners/enums/linkTargets`

```json
[
  { "id": "_self",  "name": "Cùng tab" },
  { "id": "_blank", "name": "Tab mới" }
]
```

### Lấy danh sách vị trí banner (cho dropdown `locationId`)

**GET** `/public/banner-locations/options`

Chỉ trả về location đang `active`, dùng để render dropdown chọn vị trí khi tạo/sửa banner.

```json
[
  { "id": "1", "name": "Trang chủ - Hero",  "code": "homepage-hero" },
  { "id": "2", "name": "Sidebar phải",      "code": "sidebar-right" },
  { "id": "3", "name": "Popup khuyến mãi", "code": "promo-popup" }
]
```

> Dùng `id` làm value cho `locationId`, hiển thị `name` làm label.

---

## Admin CRUD (`/admin/banners`)

### 1. Danh Sách Banner

**GET** `/admin/banners`

#### Query Parameters

| Tham số      | Kiểu    | Mô tả                                                             |
|--------------|---------|-------------------------------------------------------------------|
| `page`       | number  | Trang hiện tại (mặc định: `1`)                                    |
| `limit`      | number  | Số item/trang (mặc định: `10`)                                    |
| `search`     | string  | Tìm theo `title` hoặc `subtitle`                                  |
| `status`     | string  | Lọc theo giá trị từ `/banners/enums/statuses`                     |
| `locationId` | string  | Lọc theo ID vị trí, truyền dạng numeric string, VD: `"3"`         |
| `sort`       | string  | `sortOrder:asc` / `createdAt:desc` / `title:asc` / `status:desc` |
| `skipCount`  | boolean | `"true"` để bỏ qua đếm tổng                                       |

#### Response

```json
{
  "success": true,
  "data": [
    {
      "id": "1",
      "title": "Banner Tết 2025",
      "subtitle": "Ưu đãi đặc biệt",
      "image": "https://cdn.example.com/banner.jpg",
      "mobileImage": "https://cdn.example.com/banner-mobile.jpg",
      "link": "https://example.com/sale",
      "linkTarget": "_blank",
      "description": "Nội dung mô tả banner",
      "buttonText": "Xem ngay",
      "buttonColor": "#FF0000",
      "textColor": "#FFFFFF",
      "locationId": "1",
      "sortOrder": 0,
      "status": "active",
      "startDate": "2025-01-01T00:00:00.000Z",
      "endDate": "2025-02-01T00:00:00.000Z",
      "location": {
        "id": "1",
        "code": "homepage-hero",
        "name": "Trang chủ - Hero"
      },
      "createdAt": "2025-01-01T00:00:00.000Z",
      "updatedAt": "2025-01-01T00:00:00.000Z"
    }
  ],
  "meta": { "page": 1, "limit": 10, "total": 50, "totalPages": 5 }
}
```

### 2. Chi Tiết Banner

**GET** `/admin/banners/:id`

Trả về object banner đầy đủ kèm `location`.

### 3. Tạo Banner

**POST** `/admin/banners`

| Trường        | Kiểu    | Bắt buộc | Mô tả                                                               |
|---------------|---------|----------|---------------------------------------------------------------------|
| `title`       | string  | **Có**   | Tiêu đề (max 255 ký tự)                                             |
| `locationId`  | number  | **Có**   | ID vị trí — lấy từ `GET /public/banner-locations/options`           |
| `subtitle`    | string  | Không    | Tiêu đề phụ (max 500 ký tự)                                         |
| `image`       | string  | Không    | URL ảnh desktop (max 500 ký tự)                                     |
| `mobileImage` | string  | Không    | URL ảnh mobile (max 500 ký tự)                                      |
| `link`        | string  | Không    | URL liên kết, **bắt buộc http/https** (max 500 ký tự)               |
| `linkTarget`  | string  | Không    | Giá trị từ `/banners/enums/linkTargets` (mặc định: `_self`)         |
| `description` | string  | Không    | Mô tả (max 2000 ký tự)                                              |
| `buttonText`  | string  | Không    | Nhãn nút bấm (max 100 ký tự)                                        |
| `buttonColor` | string  | Không    | Màu nút — **mã hex hợp lệ**, VD: `#FF0000`                          |
| `textColor`   | string  | Không    | Màu chữ — **mã hex hợp lệ**, VD: `#FFFFFF`                          |
| `sortOrder`   | number  | Không    | Thứ tự sắp xếp, min `0`, max `1000000` (mặc định: `0`)             |
| `status`      | string  | Không    | Giá trị từ `/banners/enums/statuses` (mặc định: `active`)           |
| `startDate`   | string  | Không    | ISO 8601, VD: `"2025-01-01T00:00:00Z"`                              |
| `endDate`     | string  | Không    | ISO 8601, VD: `"2025-02-01T00:00:00Z"`                              |

**Validation:**
- `link` phải bắt đầu `http://` hoặc `https://`.
- `buttonColor`, `textColor` phải là hex hợp lệ (`#RGB` hoặc `#RRGGBB`).
- `locationId` phải tồn tại — trả 404 nếu không tìm thấy.

### 4. Cập Nhật Banner

**PUT** `/admin/banners/:id` — Body giống Tạo, tất cả trường tuỳ chọn.

### 5. Xóa Banner

**DELETE** `/admin/banners/:id` → `{ "success": true }`

---

## Ghi Chú

| Điểm                  | Chi tiết                                                                 |
|-----------------------|--------------------------------------------------------------------------|
| Kiểu `id`             | String (BigInt serialized) — không parse sang `number` ở JS              |
| `locationId` gửi lên  | Gửi là `number`, nhận về trong response là `string`                      |
| `sortOrder`           | Banner cùng `sortOrder` sắp theo `id` tăng dần                           |
| `startDate`/`endDate` | Chỉ ảnh hưởng public API. Admin thấy banner bất kể ngày                  |
| Xóa location          | Cascade xóa toàn bộ banner thuộc location — cần cảnh báo người dùng     |
