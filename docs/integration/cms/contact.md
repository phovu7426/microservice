# CMS Liên Hệ (Contact) — Tài Liệu Tích Hợp Admin

> **Service:** cms-service  
> **Permission:** `cms.contact.manage`  
> **Base path:** `/admin/contacts`  
> **Headers:** `Authorization: Bearer <token>`

Admin **chỉ xem và xử lý** liên hệ. Không có create/delete — form liên hệ do public user gửi lên qua API public.

---

## Enum & Options APIs (Public — không cần auth)

### Lấy danh sách trạng thái

**GET** `/contacts/enums/statuses`

```json
[
  { "id": "Pending", "name": "Chờ xử lý" },
  { "id": "Read",    "name": "Đã đọc" },
  { "id": "Replied", "name": "Đã trả lời" },
  { "id": "Closed",  "name": "Đã đóng" }
]
```

> **Lưu ý:** Giá trị `id` viết hoa chữ đầu (`Pending`, `Read`, ...) — truyền đúng như vậy khi filter.

---

## Admin Endpoints (`/admin/contacts`)

### 1. Danh Sách Liên Hệ

**GET** `/admin/contacts`

| Tham số     | Kiểu    | Mô tả                                                         |
|-------------|---------|---------------------------------------------------------------|
| `page`      | number  | Trang hiện tại (mặc định: `1`)                                |
| `limit`     | number  | Số item/trang (mặc định: `10`)                                |
| `search`    | string  | Tìm theo `name` hoặc `message`                                |
| `status`    | string  | Lọc: `Pending` / `Read` / `Replied` / `Closed`                |
| `email`     | string  | Lọc chính xác theo email                                      |
| `skipCount` | boolean | `"true"` bỏ qua đếm tổng                                      |

#### Response

```json
{
  "success": true,
  "data": [
    {
      "id": "1",
      "name": "Nguyễn Văn A",
      "email": "a@example.com",
      "phone": "0901234567",
      "message": "Tôi muốn hỏi về dịch vụ...",
      "status": "Pending",
      "reply": null,
      "repliedAt": null,
      "repliedBy": null,
      "createdAt": "2025-01-01T00:00:00.000Z",
      "updatedAt": "2025-01-01T00:00:00.000Z"
    }
  ],
  "meta": { "page": 1, "limit": 10, "total": 25, "totalPages": 3 }
}
```

### 2. Chi Tiết Liên Hệ

**GET** `/admin/contacts/:id`

Tự động chuyển trạng thái từ `Pending` → `Read` khi xem chi tiết.

### 3. Trả Lời Liên Hệ

**PATCH** `/admin/contacts/:id/reply`

```json
{ "reply": "Kính gửi Anh/Chị, chúng tôi xin phản hồi..." }
```

| Trường  | Kiểu   | Bắt buộc | Mô tả                              |
|---------|--------|----------|------------------------------------|
| `reply` | string | **Có**   | Nội dung trả lời (1–20.000 ký tự)  |

Sau khi reply thành công, `status` tự động chuyển thành `Replied`.

### 4. Đánh Dấu Đã Đọc

**PATCH** `/admin/contacts/:id/read`

Không cần body. Chuyển `status` → `Read`.

### 5. Đóng Liên Hệ

**PATCH** `/admin/contacts/:id/close`

Không cần body. Chuyển `status` → `Closed`.

---

## Luồng Trạng Thái

```
Pending → Read (xem chi tiết hoặc đánh dấu đã đọc)
Pending/Read → Replied (trả lời)
Bất kỳ → Closed (đóng thủ công)
```

---

## Ghi Chú

| Điểm       | Chi tiết                                                         |
|------------|------------------------------------------------------------------|
| `id`       | String (BigInt serialized)                                       |
| `status`   | Giá trị viết hoa chữ đầu: `Pending`, `Read`, `Replied`, `Closed` |
| `repliedBy`| ID của admin đã reply (BigInt string)                            |
| Không có POST/DELETE từ admin — liên hệ do user public tạo ra   |
