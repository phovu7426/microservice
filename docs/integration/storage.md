# Storage Service — Tích hợp Upload File

Base URL: `/api/storage`

---

## Upload nhiều file

**`POST /api/storage/upload/files`**

- Auth: không yêu cầu (public)
- Rate limit: **5 request / phút** mỗi IP
- Content-Type: `multipart/form-data`
- Field name: `files`
- Tối đa: **10 file / request**, mỗi file ≤ **10 MB**

### Request

```http
POST /api/storage/upload/files
Content-Type: multipart/form-data

files: <file1>
files: <file2>
...
```

### Fetch API

```js
const formData = new FormData();
files.forEach(file => formData.append('files', file));

const res = await fetch('/api/storage/upload/files', {
  method: 'POST',
  body: formData,
});

const uploaded = await res.json(); // UploadResponseDto[]
const imageUrls = uploaded.map(f => f.url);
```

### Axios

```js
const formData = new FormData();
files.forEach(file => formData.append('files', file));

const { data } = await axios.post('/api/storage/upload/files', formData, {
  headers: { 'Content-Type': 'multipart/form-data' },
});
// data: UploadResponseDto[]
```

### Response

```json
[
  {
    "path": "upload/1779726373196-3880e7b5.jpg",
    "url": "/api/storage/upload/1779726373196-3880e7b5.jpg",
    "filename": "1779726373196-3880e7b5.jpg",
    "size": 204800,
    "mimetype": "image/jpeg"
  }
]
```

| Field | Mô tả |
|-------|-------|
| `path` | Đường dẫn tương đối trong storage |
| `url` | URL dùng để truy cập file (dùng giá trị này lưu vào DB) |
| `filename` | Tên file sau khi đã được đặt lại |
| `size` | Kích thước byte |
| `mimetype` | MIME type của file |

---

## Upload một file

**`POST /api/storage/upload/file`**

- Giống trên nhưng field name là `file` (số ít), tối đa 1 file
- Response là object đơn (không phải mảng)

---

## Xem file

**`GET /api/storage/upload/:filename`** — public, trả về nội dung file trực tiếp

---

## Định dạng được chấp nhận

| Loại | Đuôi file |
|------|-----------|
| Ảnh | `.jpg` `.jpeg` `.png` `.gif` `.webp` `.bmp` `.ico` |
| Tài liệu | `.pdf` `.doc` `.docx` `.xls` `.xlsx` `.ppt` `.pptx` `.txt` `.csv` |
| Nén | `.zip` `.rar` `.7z` `.tar` `.gz` |
| Video | `.mp4` `.avi` `.mov` `.wmv` `.flv` `.webm` `.mkv` |
| Âm thanh | `.mp3` `.wav` `.ogg` `.m4a` `.aac` |

> **SVG bị chặn** do nguy cơ XSS.

---

## Flow tích hợp với CMS (ví dụ: project images)

```
1. User chọn file ảnh trên FE
         ↓
2. POST /api/storage/upload/files  →  nhận về url[]
         ↓
3. Lưu url[] vào payload:  { images: ["/api/storage/upload/xxx.jpg", ...] }
         ↓
4. POST/PUT /api/cms/admin/projects
```

> Không được gửi `blob:` URL vào các trường lưu ảnh — backend sẽ trả về lỗi 400.

---

## Lỗi thường gặp

| HTTP | Nguyên nhân |
|------|-------------|
| 400 | File rỗng / thiếu field `files` |
| 400 | File vượt 10 MB |
| 400 | Định dạng không được phép (SVG, HTML, EXE...) |
| 429 | Gọi quá 5 lần / phút |
