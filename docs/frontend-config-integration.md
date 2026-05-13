# Tich hop Config Service — Tai lieu API cho Frontend

> **Base URL:** `/api/config` (qua Nginx proxy -> config-service:3003)
>
> Tat ca path ben duoi deu co prefix `/api/config`. Vi du: `GET /api/config/general`

---

## Cau truc Response chung

```json
// Danh sach
{
  "success": true,
  "message": "Success",
  "code": "SUCCESS",
  "httpStatus": 200,
  "data": [...],
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 100,
    "totalPages": 10,
    "hasNextPage": true,
    "hasPreviousPage": false
  },
  "timestamp": "2026-05-13T10:00:00+07:00"
}

// Single object
{
  "success": true,
  "message": "Success",
  "code": "SUCCESS",
  "httpStatus": 200,
  "data": { ... },
  "meta": {},
  "timestamp": "2026-05-13T10:00:00+07:00"
}
```

---

## Phan quyen

| Ky hieu | Nghia |
|---------|-------|
| Public | Khong can dang nhap |
| User | Can header `Authorization: Bearer {token}` |
| Admin | Can JWT co quyen admin tuong ung |

---

## Luu y chung

- **Request body, query params va response deu dung camelCase** — `countryId`, `siteName`, khong phai `country_id`, `site_name`.
- **ID la string** — BigInt serialize thanh string. Gui len phai la numeric string (VD: `"123"`).
- **Enum `status`:** `"active"` | `"inactive"`.
- **Menu `type`:** `"route"` | `"group"` | `"link"`.
- **Boolean trong query string:** gui `"true"` hoac `"1"`.
- **Query param dung camelCase**: `countryId=1`, KHONG dung `filter[country_id]=1`.

---

## Tham so phan trang chung (ap dung cho moi List API)

| Param | Kieu | Default | Mo ta |
|-------|------|---------|-------|
| `page` | number | `1` | Trang hien tai |
| `limit` | number | `10` | So ban ghi moi trang (max 100) |
| `search` | string | — | Tim kiem toan van (max 200) |
| `sort` | string | — | Vi du: `name:ASC`, `createdAt:DESC` |
| `skipCount` | boolean string | `"false"` | `"true"` -> bo qua dem tong (tang hieu nang) |

**Response `meta` cho List:**

```json
{
  "page": 1,
  "limit": 10,
  "total": 100,
  "totalPages": 10,
  "hasNextPage": true,
  "hasPreviousPage": false
}
```

---

## 1. General Config

### Public GET `/api/config/general`

Lay cau hinh chung cua site (cache Redis 10 phut).

**Response `data`:**

```json
{
  "id": "1",
  "siteName": "Comic Platform",
  "siteDescription": "Mo ta site",
  "siteLogo": "https://cdn.example.com/logo.png",
  "siteFavicon": "https://cdn.example.com/favicon.ico",
  "siteEmail": "admin@example.com",
  "sitePhone": "0901234567",
  "siteAddress": "123 Duong Sach, TP.HCM",
  "siteCountryId": "1",
  "siteProvinceId": "2",
  "siteWardId": "3",
  "siteCopyright": "2026 Comic Platform",
  "timezone": "Asia/Ho_Chi_Minh",
  "locale": "vi",
  "currency": "VND",
  "contactChannels": [
    {
      "type": "facebook",
      "value": "https://fb.com/page",
      "label": "Facebook",
      "icon": "facebook-icon",
      "urlTemplate": null,
      "enabled": true,
      "sortOrder": 1
    }
  ],
  "metaTitle": "Comic Platform",
  "metaKeywords": "truyen tranh, manga",
  "ogTitle": "Comic Platform",
  "ogDescription": "Doc truyen tranh online",
  "ogImage": "https://cdn.example.com/og.jpg",
  "canonicalUrl": "https://example.com",
  "googleAnalyticsId": "G-XXXXXXXXXX",
  "facebookPixelId": "123456789",
  "twitterSite": "@handle",
  "createdUserId": null,
  "updatedUserId": null,
  "createdAt": "2026-01-01T00:00:00.000Z",
  "updatedAt": "2026-05-13T10:00:00.000Z"
}
```

---

### Admin GET `/api/config/admin/general`

Lay cau hinh (admin, quyen `config.manage`). Giong public, them `googleSearchConsole`.

---

### Admin PUT `/api/config/admin/general`

Cap nhat cau hinh chung (quyen `config.manage`). Tat ca field optional — chi gui field can thay doi.

**Request Body:**

```json
{
  "siteName": "string (max 255)",
  "siteDescription": "string",
  "siteLogo": "URL http/https (max 500)",
  "siteFavicon": "URL http/https (max 500)",
  "siteEmail": "email (max 255)",
  "sitePhone": "string (max 20)",
  "siteAddress": "string",
  "siteCountryId": "numeric string (1-20 digits)",
  "siteProvinceId": "numeric string (1-20 digits)",
  "siteWardId": "numeric string (1-20 digits)",
  "siteCopyright": "string (max 255)",
  "timezone": "string (max 50), VD: 'Asia/Ho_Chi_Minh'",
  "locale": "string (max 10), VD: 'vi'",
  "currency": "string (max 10), VD: 'VND'",
  "contactChannels": [
    {
      "type": "string (bat buoc)",
      "value": "string (bat buoc)",
      "label": "string? (max 255)",
      "icon": "string? (max 500)",
      "urlTemplate": "string? (max 500)",
      "enabled": true,
      "sortOrder": 0
    }
  ],
  "metaTitle": "string (max 255)",
  "metaKeywords": "string",
  "ogTitle": "string (max 255)",
  "ogDescription": "string",
  "ogImage": "URL http/https (max 500)",
  "canonicalUrl": "URL http/https (max 500)",
  "googleAnalyticsId": "string (max 50)",
  "googleSearchConsole": "string (max 255)",
  "facebookPixelId": "string (max 50)",
  "twitterSite": "string (max 50)"
}
```

---

## 2. Email Config

### Admin PUT `/api/config/admin/email`

Cap nhat cau hinh SMTP email (quyen `config.manage`). Tat ca field optional.

**Request Body:**

```json
{
  "smtpHost": "string (valid public hostname, max 255)",
  "smtpPort": "number (1-65535)",
  "smtpSecure": "boolean",
  "smtpUsername": "string (max 255)",
  "smtpPassword": "string (min 6, max 500)",
  "fromEmail": "email (max 255)",
  "fromName": "string (max 255)",
  "replyToEmail": "email (max 255)"
}
```

**Response `data`:**

```json
{
  "id": "1",
  "smtpHost": "smtp.example.com",
  "smtpPort": 587,
  "smtpSecure": true,
  "smtpUsername": "user@example.com",
  "smtpPassword": "••••••",
  "fromEmail": "noreply@example.com",
  "fromName": "Comic Platform",
  "replyToEmail": null,
  "createdUserId": null,
  "updatedUserId": null,
  "createdAt": "2026-01-01T00:00:00.000Z",
  "updatedAt": "2026-05-13T10:00:00.000Z"
}
```

---

## 3. Menu

### Public GET `/api/config/menus`

Lay cay menu public (group `client`, status `active`, cache 10 phut).

**Response `data`:**

```json
[
  {
    "id": "1",
    "code": "home",
    "name": "Trang chu",
    "path": "/",
    "icon": "home",
    "type": "route",
    "status": "active",
    "isPublic": true,
    "children": [
      {
        "id": "2",
        "code": "home.intro",
        "name": "Gioi thieu",
        "path": "/intro",
        "icon": null,
        "type": "route",
        "status": "active",
        "isPublic": true,
        "children": []
      }
    ]
  }
]
```

---

### User GET `/api/config/user/menus`

Lay cay menu admin theo quyen cua user dang dang nhap.

**Headers:**
- `Authorization: Bearer {token}` (bat buoc)
- `x-group-id: {groupId}` (tuy chon — neu user thuoc nhieu group)

**Response `data`:** Mang cay menu, chi gom item user co quyen.

---

### Admin GET `/api/config/admin/menus`

Danh sach menu co phan trang (quyen `menu.manage`).

**Query params:**

| Param | Kieu | Mo ta |
|-------|------|-------|
| `status` | `active` \| `inactive` | |
| `parentId` | numeric string | Loc theo menu cha |
| `showInMenu` | boolean string | `"true"` \| `"false"` |
| `group` | string (max 50) | `admin`, `client`, ... |
| + phan trang | | |

---

### Admin GET `/api/config/admin/menus/tree`

Toan bo cay menu dang tree (khong phan trang).

---

### Admin GET `/api/config/admin/menus/:id`

Chi tiet menu.

**Response `data`:**

```json
{
  "id": "1",
  "code": "dashboard",
  "name": "Dashboard",
  "path": "/dashboard",
  "apiPath": "/api/admin/dashboard",
  "icon": "dashboard",
  "type": "route",
  "status": "active",
  "parentId": null,
  "sortOrder": 0,
  "isPublic": false,
  "showInMenu": true,
  "group": "admin",
  "requiredPermissionCode": "dashboard.view",
  "createdAt": "2026-01-01T00:00:00.000Z",
  "updatedAt": "2026-01-01T00:00:00.000Z",
  "parent": { "id": "1", "name": "...", "code": "..." }
}
```

---

### Admin POST `/api/config/admin/menus`

Tao menu moi. (HTTP 201)

```json
{
  "code": "string (3-120, bat buoc, unique)",
  "name": "string (max 150, bat buoc)",
  "path": "string? (max 255)",
  "apiPath": "string? (max 255)",
  "icon": "string? (max 120)",
  "type": "route | group | link",
  "status": "active | inactive",
  "parentId": "numeric string?",
  "sortOrder": 0,
  "isPublic": false,
  "showInMenu": true,
  "requiredPermissionCode": "string? (max 120)",
  "group": "string? (max 50, default: 'admin')"
}
```

**Loi:** `400` — code da ton tai, parentId khong hop le, phat hien vong lap parent.

---

### Admin PUT `/api/config/admin/menus/:id`

Cap nhat menu. Giong POST, tat ca optional. `parentId` truyen `null` hoac `""` de bo parent.

---

### Admin DELETE `/api/config/admin/menus/:id`

Xoa menu. **Response `data`:** `true`

---

## 4. Quoc gia (Country)

### Public GET `/api/config/countries`

Danh sach quoc gia (chi active, cache 24h).

**Query params:** `name`, `code` + phan trang

**Response `data[i]`:**

```json
{
  "id": "1",
  "code": "VN",
  "codeAlpha3": "VNM",
  "name": "Viet Nam",
  "officialName": "Cong hoa Xa hoi Chu nghia Viet Nam",
  "phoneCode": "+84",
  "currencyCode": "VND",
  "flagEmoji": "VN",
  "status": "active",
  "createdUserId": null,
  "updatedUserId": null,
  "createdAt": "2026-01-01T00:00:00.000Z",
  "updatedAt": "2026-01-01T00:00:00.000Z"
}
```

---

### Public GET `/api/config/countries/:id/provinces`

Danh sach tinh/thanh cua quoc gia (chi active, cache 24h).

**Query params:** `name`, `code` + phan trang

---

### Admin GET `/api/config/admin/countries`

Danh sach quoc gia admin (bao gom inactive, quyen `country.manage`).

**Query params them:** `status` (`active` | `inactive`), `name`, `code` + phan trang

---

### Admin GET `/api/config/admin/countries/simple`

Danh sach rut gon (limit 1000, skipCount forced) — dung cho dropdown.

---

### Admin GET `/api/config/admin/countries/:id`

Chi tiet quoc gia. Response giong `data[i]` cua list.

---

### Admin POST `/api/config/admin/countries`

Tao quoc gia moi. (HTTP 201)

```json
{
  "code": "string (max 10, bat buoc) — ISO alpha-2, VD: 'VN'",
  "codeAlpha3": "string? (max 10) — VD: 'VNM'",
  "name": "string (max 255, bat buoc)",
  "officialName": "string? (max 255)",
  "phoneCode": "string? (max 20) — VD: '+84'",
  "currencyCode": "string? (max 20)",
  "flagEmoji": "string? (max 20)",
  "status": "active | inactive"
}
```

---

### Admin PATCH `/api/config/admin/countries/:id`

Cap nhat. Tat ca optional.

---

### Admin DELETE `/api/config/admin/countries/:id`

Xoa. **`409 Conflict`** neu con tinh/thanh lien ket. **Response `data`:** `true`

---

## 5. Tinh/Thanh pho (Province)

### Public GET `/api/config/provinces`

**Query params:** `name`, `code` + phan trang

**Response `data[i]`:**

```json
{
  "id": "1",
  "code": "HCM",
  "name": "Ho Chi Minh",
  "type": "Thanh pho Truc thuoc Trung uong",
  "phoneCode": "028",
  "countryId": "1",
  "status": "active",
  "note": null,
  "codeBnv": null,
  "codeTms": null,
  "createdUserId": null,
  "updatedUserId": null,
  "createdAt": "2026-01-01T00:00:00.000Z",
  "updatedAt": "2026-01-01T00:00:00.000Z"
}
```

---

### Public GET `/api/config/countries/:countryId/provinces`

Tinh theo quoc gia (cache 24h).

---

### Public GET `/api/config/provinces/:id/wards`

Phuong/xa theo tinh (cache 24h). **Query params:** `name`, `code` + phan trang

---

### Admin GET `/api/config/admin/provinces`

**Query params:** `name`, `code`, `status`, `countryId` + phan trang

---

### Admin GET `/api/config/admin/provinces/simple`

Dropdown — limit 1000, skipCount forced.

---

### Admin GET `/api/config/admin/provinces/:id`

Chi tiet tinh. Response giong `data[i]` cua list.

---

### Admin POST `/api/config/admin/provinces`

Tao tinh moi. (HTTP 201)

```json
{
  "code": "string (max 20, bat buoc)",
  "name": "string (max 255, bat buoc)",
  "type": "string (max 50, bat buoc) — VD: 'Tinh', 'Thanh pho Truc thuoc Trung uong'",
  "phoneCode": "string? (max 20)",
  "countryId": "numeric string (1-20 digits, bat buoc)",
  "status": "active | inactive",
  "note": "string? (max 2000)",
  "codeBnv": "string? (max 20)",
  "codeTms": "string? (max 20)"
}
```

### Admin GET `:id` / PATCH `:id` / DELETE `:id`

CRUD tieu chuan. DELETE tra `true`. Wards bi cascade xoa khi xoa tinh.

---

## 6. Phuong/Xa (Ward)

### Public GET `/api/config/wards`

**Query params:** `name`, `code` + phan trang

**Response `data[i]`:**

```json
{
  "id": "1",
  "provinceId": "1",
  "name": "Phuong Ben Nghe",
  "type": "Phuong",
  "code": "26734",
  "status": "active",
  "createdUserId": null,
  "updatedUserId": null,
  "createdAt": "2026-01-01T00:00:00.000Z",
  "updatedAt": "2026-01-01T00:00:00.000Z"
}
```

---

### Public GET `/api/config/provinces/:provinceId/wards`

Phuong/xa theo tinh (cache 24h).

---

### Admin GET `/api/config/admin/wards`

**Query params:** `name`, `code`, `status`, `provinceId` + phan trang

---

### Admin GET `/api/config/admin/wards/simple`

Dropdown — limit 1000, skipCount forced.

---

### Admin GET `/api/config/admin/wards/:id`

Chi tiet phuong/xa. Response giong `data[i]` cua list.

---

### Admin POST `/api/config/admin/wards`

Tao phuong/xa moi. (HTTP 201)

```json
{
  "provinceId": "numeric string (1-20 digits, bat buoc)",
  "name": "string (max 255, bat buoc)",
  "type": "string (max 50, bat buoc) — VD: 'Phuong', 'Xa', 'Thi tran'",
  "code": "string (max 20, bat buoc)",
  "status": "active | inactive"
}
```

### Admin GET `:id` / PATCH `:id` / DELETE `:id`

CRUD tieu chuan. DELETE tra `true`.

---

## 7. Cache

### Public GET `/api/config/cache/flush`

Xoa toan bo Redis cache. **Throttle: 5 req/60s.**

**Response `data`:**

```json
{
  "flushed": true,
  "reason": "redis_disabled"
}
```

> `reason` chi co khi `flushed = false`.

---

## Luong tich hop dia chi (Country -> Province -> Ward)

```
1. GET /api/config/countries?limit=200
   -> Hien thi dropdown quoc gia

2. Khi chon quoc gia (countryId):
   GET /api/config/countries/{countryId}/provinces?limit=100
   -> Hien thi dropdown tinh/thanh

3. Khi chon tinh (provinceId):
   GET /api/config/provinces/{provinceId}/wards?limit=500
   -> Hien thi dropdown phuong/xa
```

---

## Tong hop endpoint

| Method | Path | Auth | Mo ta |
|--------|------|------|-------|
| GET | `/api/config/general` | Public | Cau hinh chung |
| GET | `/api/config/admin/general` | Admin | Cau hinh chung (admin) |
| PUT | `/api/config/admin/general` | Admin | Cap nhat cau hinh chung |
| PUT | `/api/config/admin/email` | Admin | Cap nhat SMTP email |
| GET | `/api/config/menus` | Public | Menu public |
| GET | `/api/config/user/menus` | User | Menu theo quyen user |
| GET | `/api/config/admin/menus` | Admin | Danh sach menu |
| GET | `/api/config/admin/menus/tree` | Admin | Cay menu |
| GET | `/api/config/admin/menus/:id` | Admin | Chi tiet menu |
| POST | `/api/config/admin/menus` | Admin | Tao menu |
| PUT | `/api/config/admin/menus/:id` | Admin | Cap nhat menu |
| DELETE | `/api/config/admin/menus/:id` | Admin | Xoa menu |
| GET | `/api/config/countries` | Public | DS quoc gia |
| GET | `/api/config/countries/:id/provinces` | Public | Tinh theo quoc gia |
| GET | `/api/config/admin/countries` | Admin | DS quoc gia (admin) |
| GET | `/api/config/admin/countries/simple` | Admin | Dropdown quoc gia |
| GET | `/api/config/admin/countries/:id` | Admin | Chi tiet quoc gia |
| POST | `/api/config/admin/countries` | Admin | Tao quoc gia |
| PATCH | `/api/config/admin/countries/:id` | Admin | Cap nhat quoc gia |
| DELETE | `/api/config/admin/countries/:id` | Admin | Xoa quoc gia |
| GET | `/api/config/provinces` | Public | DS tinh/thanh |
| GET | `/api/config/countries/:countryId/provinces` | Public | Tinh theo quoc gia |
| GET | `/api/config/provinces/:id/wards` | Public | Phuong/xa theo tinh |
| GET | `/api/config/admin/provinces` | Admin | DS tinh (admin) |
| GET | `/api/config/admin/provinces/simple` | Admin | Dropdown tinh |
| GET | `/api/config/admin/provinces/:id` | Admin | Chi tiet tinh |
| POST | `/api/config/admin/provinces` | Admin | Tao tinh |
| PATCH | `/api/config/admin/provinces/:id` | Admin | Cap nhat tinh |
| DELETE | `/api/config/admin/provinces/:id` | Admin | Xoa tinh |
| GET | `/api/config/wards` | Public | DS phuong/xa |
| GET | `/api/config/provinces/:provinceId/wards` | Public | Phuong/xa theo tinh |
| GET | `/api/config/admin/wards` | Admin | DS phuong/xa (admin) |
| GET | `/api/config/admin/wards/simple` | Admin | Dropdown phuong/xa |
| GET | `/api/config/admin/wards/:id` | Admin | Chi tiet phuong/xa |
| POST | `/api/config/admin/wards` | Admin | Tao phuong/xa |
| PATCH | `/api/config/admin/wards/:id` | Admin | Cap nhat phuong/xa |
| DELETE | `/api/config/admin/wards/:id` | Admin | Xoa phuong/xa |
| GET | `/api/config/cache/flush` | Public | Xoa cache |
