# Tich hop Config Service vao Frontend

> Base URL: `/api/config` (qua Nginx proxy den config-service:3003)

---

## Muc luc

1. [Tong quan](#1-tong-quan)
2. [Response format chung](#2-response-format-chung)
3. [General Config (cau hinh website)](#3-general-config-cau-hinh-website)
4. [Menu](#4-menu)
5. [Location — Quoc gia (Country)](#5-location--quoc-gia-country)
6. [Location — Tinh/Thanh (Province)](#6-location--tinhthanh-province)
7. [Location — Phuong/Xa (Ward)](#7-location--phuongxa-ward)
8. [Admin — Country CRUD](#8-admin--country-crud)
9. [Admin — Province CRUD](#9-admin--province-crud)
10. [Admin — Ward CRUD](#10-admin--ward-crud)
11. [Admin — Menu CRUD](#11-admin--menu-crud)
12. [Admin — Email Config](#12-admin--email-config)
13. [Admin — General Config](#13-admin--general-config)
14. [Xu ly loi](#14-xu-ly-loi)

---

## 1. Tong quan

Config Service quan ly:
- **General config**: ten website, logo, thong tin lien he, SEO, analytics
- **Email config**: cau hinh SMTP
- **Menu**: cay menu dong (public, user, admin)
- **Location**: quoc gia / tinh-thanh / phuong-xa

**Phan quyen:**

| Loai | Mo ta | Header can thiet |
|------|-------|-----------------|
| Public | Khong can dang nhap | Khong |
| User | Can JWT (dang nhap) | `Authorization: Bearer <token>` |
| Admin | Can JWT + permission | `Authorization: Bearer <token>` |

---

## 2. Response format chung

Moi response deu duoc wrap boi `TransformInterceptor`:

```json
{
  "success": true,
  "data": { ... },
  "meta": null,
  "timestamp": "2026-05-09T10:00:00.000Z"
}
```

**Danh sach co phan trang:**
```json
{
  "success": true,
  "data": [ ... ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8
  },
  "timestamp": "2026-05-09T10:00:00.000Z"
}
```

**Query params phan trang dung chung cho moi endpoint danh sach:**

| Param | Kieu | Mac dinh | Mo ta |
|-------|------|---------|-------|
| `page` | number | 1 | So trang |
| `limit` | number | 20 | So ban ghi moi trang |
| `search` | string | — | Tim kiem full-text (max 200 ky tu) |
| `sort` | string | — | Vi du: `name:asc`, `createdAt:desc` |
| `skipCount` | boolean | false | Bo qua dem tong (dung cho infinite scroll) |

---

## 3. General Config (cau hinh website)

### Lay config public

```
GET /api/config/general
```

Khong can xac thuc. Ket qua duoc cache Redis 24h.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "1",
    "site_name": "Comic Platform",
    "site_description": "Nen tang truyen tranh truc tuyen",
    "site_logo": "https://cdn.example.com/logo.png",
    "site_favicon": "https://cdn.example.com/favicon.ico",
    "site_email": "contact@example.com",
    "site_phone": "0901234567",
    "site_address": "123 Nguyen Hue, Q1, TP.HCM",
    "site_country_id": "1",
    "site_province_id": "79",
    "site_ward_id": "26734",
    "site_copyright": "© 2026 Comic Platform",
    "timezone": "Asia/Ho_Chi_Minh",
    "locale": "vi",
    "currency": "VND",
    "contact_channels": [
      {
        "type": "facebook",
        "value": "comicplatform",
        "label": "Facebook",
        "url_template": "https://facebook.com/{value}",
        "enabled": true,
        "sort_order": 1
      }
    ],
    "meta_title": "Comic Platform — Doc truyen online",
    "meta_keywords": "truyen tranh, comic, manga",
    "og_title": "Comic Platform",
    "og_description": "Nen tang truyen tranh truc tuyen",
    "og_image": "https://cdn.example.com/og.jpg",
    "canonical_url": "https://comicplatform.vn",
    "google_analytics_id": "G-XXXXXXXXXX",
    "facebook_pixel_id": "123456789",
    "twitter_site": "@comicplatform",
    "created_at": "2026-01-01T00:00:00.000Z",
    "updated_at": "2026-05-09T10:00:00.000Z"
  }
}
```

> **Luu y:** Response tra ve snake_case vi day la du lieu DB. Frontend tu xu ly mapping neu can.

---

## 4. Menu

### 4.1 Menu public (khong can dang nhap)

Lay cay menu public de hien thi navigation cho khach.

```
GET /api/config/menus
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "1",
      "code": "home",
      "name": "Trang chu",
      "path": "/",
      "icon": "HomeIcon",
      "type": "route",
      "sort_order": 1,
      "is_public": true,
      "children": [...]
    }
  ]
}
```

---

### 4.2 Menu cua user dang nhap

Lay cay menu theo quyen cua user hien tai (loc theo permission).

```
GET /api/config/menus/user
Authorization: Bearer <token>
```

Header tuy chon:
```
x-group-id: <groupId>   (neu he thong co nhom/tenant)
```

**Response:** Cung dinh dang cay nhu 4.1, chi tra ve menu ma user co quyen truy cap.

---

### 4.3 Menu admin (danh sach phang)

```
GET /api/config/menus/admin
Authorization: Bearer <token>
```

**Query params bo sung:**

| Param | Kieu | Mo ta |
|-------|------|-------|
| `status` | `active` \| `inactive` | Loc theo trang thai |
| `parentId` | string (numeric) | Loc theo cha |
| `showInMenu` | boolean | Hien thi trong menu hay khong |
| `group` | string | Nhom menu (vd: `admin`, `user`) |

---

### 4.4 Cay menu admin

```
GET /api/config/menus/admin/tree
Authorization: Bearer <token>
```

---

## 5. Location — Quoc gia (Country)

### 5.1 Danh sach quoc gia

```
GET /api/config/countries
```

Khong can xac thuc. Ket qua duoc cache.

**Query params bo sung:**

| Param | Kieu | Mo ta |
|-------|------|-------|
| `name` | string | Tim theo ten |
| `code` | string | Tim theo ma quoc gia (vd: `VN`) |

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "1",
      "code": "VN",
      "code_alpha3": "VNM",
      "name": "Viet Nam",
      "official_name": "Cong hoa Xa hoi Chu nghia Viet Nam",
      "phone_code": "+84",
      "currency_code": "VND",
      "flag_emoji": "🇻🇳",
      "status": "active"
    }
  ],
  "meta": { "page": 1, "limit": 20, "total": 195, "totalPages": 10 }
}
```

---

### 5.2 Danh sach tinh theo quoc gia

```
GET /api/config/countries/:id/provinces
```

| Param URL | Mo ta |
|-----------|-------|
| `id` | ID quoc gia |

**Query params:** `page`, `limit`, `search`, `name`, `code`

---

## 6. Location — Tinh/Thanh (Province)

### 6.1 Danh sach tinh/thanh

```
GET /api/config/provinces
```

Khong can xac thuc. Tra ve tat ca tinh dang `active`.

**Query params bo sung:**

| Param | Kieu | Mo ta |
|-------|------|-------|
| `name` | string | Tim theo ten |
| `code` | string | Tim theo ma tinh |

---

### 6.2 Tinh theo quoc gia

```
GET /api/config/countries/:countryId/provinces
```

---

### 6.3 Phuong/xa theo tinh

```
GET /api/config/provinces/:id/wards
```

---

## 7. Location — Phuong/Xa (Ward)

### 7.1 Danh sach phuong/xa

```
GET /api/config/wards
```

**Query params bo sung:**

| Param | Kieu | Mo ta |
|-------|------|-------|
| `name` | string | Tim theo ten |
| `code` | string | Tim theo ma |

---

### 7.2 Phuong/xa theo tinh

```
GET /api/config/provinces/:provinceId/wards
```

---

## 8. Admin — Country CRUD

> Yeu cau: `Authorization: Bearer <token>` + permission `country.manage`

### 8.1 Danh sach

```
GET /api/config/admin/countries
```

**Query params bo sung:**

| Param | Kieu | Mo ta |
|-------|------|-------|
| `name` | string | Tim theo ten |
| `code` | string | Tim theo ma |
| `status` | `active` \| `inactive` | Loc trang thai |

---

### 8.2 Danh sach don gian (cho dropdown)

```
GET /api/config/admin/countries/simple
```

Tra ve toi da 1000 ban ghi, khong dem tong.

---

### 8.3 Chi tiet

```
GET /api/config/admin/countries/:id
```

---

### 8.4 Tao moi

```
POST /api/config/admin/countries
Content-Type: application/json
Authorization: Bearer <token>
```

**Request body:**
```json
{
  "code": "VN",
  "codeAlpha3": "VNM",
  "name": "Viet Nam",
  "officialName": "Cong hoa Xa hoi Chu nghia Viet Nam",
  "phoneCode": "+84",
  "currencyCode": "VND",
  "flagEmoji": "🇻🇳",
  "status": "active"
}
```

| Truong | Bat buoc | Kieu | Gioi han | Mo ta |
|--------|---------|------|---------|-------|
| `code` | ✅ | string | max 10 | Ma quoc gia (ISO 3166-1 alpha-2) |
| `name` | ✅ | string | max 255 | Ten quoc gia |
| `codeAlpha3` | | string | max 10 | Ma alpha-3 |
| `officialName` | | string | max 255 | Ten chinh thuc |
| `phoneCode` | | string | max 20 | Ma dien thoai |
| `currencyCode` | | string | max 20 | Ma tien te |
| `flagEmoji` | | string | max 20 | Emoji co |
| `status` | | `active` \| `inactive` | — | Mac dinh: `active` |

---

### 8.5 Cap nhat

```
PATCH /api/config/admin/countries/:id
Content-Type: application/json
Authorization: Bearer <token>
```

Body: cac truong giong POST, tat ca deu tuy chon.

---

### 8.6 Xoa

```
DELETE /api/config/admin/countries/:id
Authorization: Bearer <token>
```

> Tra ve 409 neu quoc gia con tinh/thanh phu thuoc.

---

## 9. Admin — Province CRUD

> Yeu cau: permission `province.manage`

### 9.1 Danh sach

```
GET /api/config/admin/provinces
```

**Query params bo sung:**

| Param | Kieu | Mo ta |
|-------|------|-------|
| `name` | string | Tim theo ten |
| `code` | string | Tim theo ma |
| `status` | `active` \| `inactive` | Loc trang thai |
| `countryId` | string (numeric) | Loc theo quoc gia |

---

### 9.2 Danh sach don gian

```
GET /api/config/admin/provinces/simple
```

---

### 9.3 Chi tiet / Tao / Cap nhat / Xoa

```
GET    /api/config/admin/provinces/:id
POST   /api/config/admin/provinces
PATCH  /api/config/admin/provinces/:id
DELETE /api/config/admin/provinces/:id
```

**Request body (POST — bat buoc):**
```json
{
  "code": "79",
  "name": "Thanh pho Ho Chi Minh",
  "type": "Thanh pho Truc thuoc Trung uong",
  "countryId": "1",
  "phoneCode": "028",
  "status": "active",
  "note": "...",
  "codeBnv": "SG",
  "codeTms": "HCM"
}
```

| Truong | Bat buoc | Kieu | Mo ta |
|--------|---------|------|-------|
| `code` | ✅ | string (max 20) | Ma tinh |
| `name` | ✅ | string (max 255) | Ten tinh |
| `type` | ✅ | string (max 50) | Loai (Thanh pho / Tinh) |
| `countryId` | ✅ | string (numeric) | ID quoc gia |
| `phoneCode` | | string (max 20) | Ma vung dien thoai |
| `status` | | `active` \| `inactive` | Mac dinh: `active` |
| `note` | | string (max 2000) | Ghi chu |
| `codeBnv` | | string (max 20) | Ma Bo Noi Vu |
| `codeTms` | | string (max 20) | Ma TMS |

> Xoa tra ve 409 neu tinh con phuong/xa phu thuoc.

---

## 10. Admin — Ward CRUD

> Yeu cau: permission `ward.manage`

```
GET    /api/config/admin/wards
GET    /api/config/admin/wards/simple
GET    /api/config/admin/wards/:id
POST   /api/config/admin/wards
PATCH  /api/config/admin/wards/:id
DELETE /api/config/admin/wards/:id
```

**Query params bo sung (danh sach):**

| Param | Kieu | Mo ta |
|-------|------|-------|
| `name` | string | Tim theo ten |
| `code` | string | Tim theo ma |
| `status` | `active` \| `inactive` | Loc trang thai |
| `provinceId` | string (numeric) | Loc theo tinh |

**Request body (POST — bat buoc):**
```json
{
  "provinceId": "760",
  "code": "26734",
  "name": "Phuong Ben Nghe",
  "type": "Phuong",
  "status": "active"
}
```

| Truong | Bat buoc | Kieu | Mo ta |
|--------|---------|------|-------|
| `provinceId` | ✅ | string (numeric) | ID tinh/thanh |
| `code` | ✅ | string (max 20) | Ma phuong/xa |
| `name` | ✅ | string (max 255) | Ten phuong/xa |
| `type` | ✅ | string (max 50) | Loai (Phuong / Xa / Thi tran) |
| `status` | | `active` \| `inactive` | Mac dinh: `active` |

---

## 11. Admin — Menu CRUD

> Yeu cau: permission `menu.manage`

### 11.1 Danh sach (phang)

```
GET /api/config/menus/admin
Authorization: Bearer <token>
```

**Query params:**

| Param | Kieu | Mo ta |
|-------|------|-------|
| `search` | string | Tim theo ten, code |
| `status` | `active` \| `inactive` | Loc trang thai |
| `parentId` | string (numeric) | Loc theo menu cha |
| `showInMenu` | boolean | Hien thi trong menu |
| `group` | string | Nhom (`admin`, `user`...) |
| `sort` | string | Mac dinh: `sort_order:asc` |

---

### 11.2 Cay menu day du

```
GET /api/config/menus/admin/tree
Authorization: Bearer <token>
```

---

### 11.3 Chi tiet

```
GET /api/config/menus/admin/:id
Authorization: Bearer <token>
```

---

### 11.4 Tao moi

```
POST /api/config/menus
Authorization: Bearer <token>
```

**Request body:**
```json
{
  "code": "comic-management",
  "name": "Quan ly truyen",
  "path": "/admin/comics",
  "apiPath": "/api/comics",
  "icon": "BookIcon",
  "type": "route",
  "status": "active",
  "parentId": "5",
  "sortOrder": 10,
  "isPublic": false,
  "showInMenu": true,
  "requiredPermissionCode": "comic.manage",
  "group": "admin"
}
```

| Truong | Bat buoc | Kieu | Mo ta |
|--------|---------|------|-------|
| `code` | ✅ | string (3–120) | Ma dinh danh duy nhat |
| `name` | ✅ | string (max 150) | Ten hien thi |
| `path` | | string (max 255) | Duong dan frontend |
| `apiPath` | | string (max 255) | Duong dan API tuong ung |
| `icon` | | string (max 120) | Ten icon |
| `type` | | `route` \| `group` \| `link` | Loai menu |
| `status` | | `active` \| `inactive` | Mac dinh: `active` |
| `parentId` | | string (numeric) | ID menu cha |
| `sortOrder` | | number (≥0) | Thu tu sap xep |
| `isPublic` | | boolean | Khong can dang nhap |
| `showInMenu` | | boolean | Hien trong sidebar |
| `requiredPermissionCode` | | string (max 120) | Ma quyen can co |
| `group` | | string (max 50) | Nhom menu |

---

### 11.5 Cap nhat

```
PUT /api/config/menus/:id
Authorization: Bearer <token>
```

Body: cac truong giong POST, tat ca tuy chon.
`parentId` co the truyen `""` (chuoi rong) hoac `null` de go bo menu cha.

---

### 11.6 Xoa

```
DELETE /api/config/menus/:id
Authorization: Bearer <token>
```

---

## 12. Admin — Email Config

> Yeu cau: permission `config.manage`

### Cap nhat cau hinh SMTP

```
PUT /api/config/config/email
Authorization: Bearer <token>
```

**Request body (tat ca truong deu tuy chon — chi gui truong can thay doi):**
```json
{
  "smtpHost": "smtp.gmail.com",
  "smtpPort": 587,
  "smtpSecure": true,
  "smtpUsername": "noreply@example.com",
  "smtpPassword": "mat_khau_smtp",
  "fromEmail": "noreply@example.com",
  "fromName": "Comic Platform",
  "replyToEmail": "support@example.com"
}
```

| Truong | Kieu | Gioi han | Mo ta |
|--------|------|---------|-------|
| `smtpHost` | string | max 255 | Hostname SMTP (khong duoc la IP noi bo) |
| `smtpPort` | number | 1–65535 | Cong SMTP |
| `smtpSecure` | boolean | — | Dung TLS/SSL |
| `smtpUsername` | string | max 255 | Tai khoan SMTP |
| `smtpPassword` | string | 6–500 ky tu | Mat khau SMTP |
| `fromEmail` | email | max 255 | Email gui di |
| `fromName` | string | max 255 | Ten nguoi gui |
| `replyToEmail` | email | max 255 | Email tra loi |

> **Luu y:**
> - Lan dau cai dat: `smtpHost`, `smtpUsername`, `smtpPassword`, `fromEmail`, `fromName` la bat buoc.
> - `smtpPassword` tra ve `"******"` khi doc. Neu gui lai gia tri nay thi he thong giu nguyen mat khau cu.

---

## 13. Admin — General Config

> Yeu cau: permission `config.manage`

### Cap nhat cau hinh website

```
PUT /api/config/config/general
Authorization: Bearer <token>
```

**Request body (tat ca truong deu tuy chon):**
```json
{
  "siteName": "Comic Platform",
  "siteDescription": "Nen tang truyen tranh truc tuyen",
  "siteLogo": "https://cdn.example.com/logo.png",
  "siteFavicon": "https://cdn.example.com/favicon.ico",
  "siteEmail": "contact@example.com",
  "sitePhone": "0901234567",
  "siteAddress": "123 Nguyen Hue, Q1, TP.HCM",
  "siteCountryId": "1",
  "siteProvinceId": "79",
  "siteWardId": "26734",
  "siteCopyright": "© 2026 Comic Platform",
  "timezone": "Asia/Ho_Chi_Minh",
  "locale": "vi",
  "currency": "VND",
  "contactChannels": [
    {
      "type": "facebook",
      "value": "comicplatform",
      "label": "Facebook",
      "urlTemplate": "https://facebook.com/{value}",
      "icon": "FacebookIcon",
      "enabled": true,
      "sortOrder": 1
    }
  ],
  "metaTitle": "Comic Platform — Doc truyen online",
  "metaKeywords": "truyen tranh, comic, manga",
  "ogTitle": "Comic Platform",
  "ogDescription": "Nen tang truyen tranh truc tuyen",
  "ogImage": "https://cdn.example.com/og.jpg",
  "canonicalUrl": "https://comicplatform.vn",
  "googleAnalyticsId": "G-XXXXXXXXXX",
  "googleSearchConsole": "verification_token",
  "facebookPixelId": "123456789",
  "twitterSite": "@comicplatform"
}
```

**Chi tiet cac truong:**

| Truong | Kieu | Mo ta |
|--------|------|-------|
| `siteName` | string (max 255) | Ten website |
| `siteDescription` | string | Mo ta website |
| `siteLogo` | url | URL logo (http/https) |
| `siteFavicon` | url | URL favicon (http/https) |
| `siteEmail` | email | Email lien he |
| `sitePhone` | string (max 20) | So dien thoai |
| `siteAddress` | string | Dia chi |
| `siteCountryId` | string (numeric) | ID quoc gia |
| `siteProvinceId` | string (numeric) | ID tinh/thanh |
| `siteWardId` | string (numeric) | ID phuong/xa |
| `siteCopyright` | string (max 255) | Ban quyen |
| `timezone` | string (max 50) | Mui gio (vd: `Asia/Ho_Chi_Minh`) |
| `locale` | string (max 10) | Ngon ngu (vd: `vi`, `en`) |
| `currency` | string (max 10) | Tien te (vd: `VND`, `USD`) |
| `contactChannels` | array | Kenh lien he (xem ben duoi) |
| `metaTitle` | string (max 255) | Meta title |
| `metaKeywords` | string | Meta keywords |
| `ogTitle` | string (max 255) | Open Graph title |
| `ogDescription` | string | Open Graph description |
| `ogImage` | url | Open Graph image |
| `canonicalUrl` | url | Canonical URL |
| `googleAnalyticsId` | string (max 50) | Google Analytics ID |
| `googleSearchConsole` | string (max 255) | Search Console verification |
| `facebookPixelId` | string (max 50) | Facebook Pixel ID |
| `twitterSite` | string (max 50) | Twitter @handle |

**ContactChannel object:**

| Truong | Bat buoc | Kieu | Mo ta |
|--------|---------|------|-------|
| `type` | ✅ | string | Loai kenh (`facebook`, `zalo`, `phone`...) |
| `value` | ✅ | string | Gia tri (so dien thoai, username...) |
| `enabled` | ✅ | boolean | Bat/tat kenh |
| `label` | | string (max 255) | Nhan hien thi |
| `icon` | | string (max 500) | Ten icon hoac URL |
| `urlTemplate` | | string (max 500) | Template URL (dung `{value}`) |
| `sortOrder` | | number | Thu tu hien thi |

---

## 14. Xu ly loi

**Cac ma loi thuong gap:**

| HTTP | Code | Mo ta |
|------|------|-------|
| 400 | BAD_REQUEST | Du lieu dau vao khong hop le |
| 401 | UNAUTHORIZED | Chua dang nhap hoac token het han |
| 403 | FORBIDDEN | Khong du quyen truy cap |
| 404 | NOT_FOUND | Khong tim thay ban ghi |
| 409 | CONFLICT | Vi pham rang buoc (vd: xoa quoc gia con tinh phu thuoc) |
| 422 | UNPROCESSABLE | Du lieu hop le nhung khong xu ly duoc |
| 500 | INTERNAL_ERROR | Loi server |

**Response loi:**
```json
{
  "success": false,
  "statusCode": 404,
  "message": "Khong tim thay quoc gia voi id: 999",
  "timestamp": "2026-05-09T10:00:00.000Z"
}
```

**Loi validation (400):**
```json
{
  "success": false,
  "statusCode": 400,
  "message": ["code must be shorter than or equal to 10 characters"],
  "timestamp": "2026-05-09T10:00:00.000Z"
}
```

---

## Code mau (Axios)

```typescript
import axios from 'axios';

const configApi = axios.create({
  baseURL: '/api/config',
});

// Them Authorization header tu dong
configApi.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// --- Public ---

// Lay general config
export const getGeneralConfig = () =>
  configApi.get('/general').then((r) => r.data.data);

// Lay danh sach quoc gia
export const getCountries = (params?: Record<string, any>) =>
  configApi.get('/countries', { params }).then((r) => r.data);

// Lay tinh theo quoc gia
export const getProvincesByCountry = (countryId: string) =>
  configApi.get(`/countries/${countryId}/provinces`).then((r) => r.data);

// Lay phuong/xa theo tinh
export const getWardsByProvince = (provinceId: string) =>
  configApi.get(`/provinces/${provinceId}/wards`).then((r) => r.data);

// Lay menu public
export const getPublicMenu = () =>
  configApi.get('/menus').then((r) => r.data.data);

// Lay menu cua user dang nhap
export const getUserMenu = () =>
  configApi.get('/menus/user').then((r) => r.data.data);

// --- Admin ---

// Cap nhat general config
export const updateGeneralConfig = (data: Record<string, any>) =>
  configApi.put('/config/general', data).then((r) => r.data.data);

// Cap nhat email config
export const updateEmailConfig = (data: Record<string, any>) =>
  configApi.put('/config/email', data).then((r) => r.data.data);

// Tao menu
export const createMenu = (data: Record<string, any>) =>
  configApi.post('/menus', data).then((r) => r.data.data);

// Cap nhat menu
export const updateMenu = (id: string, data: Record<string, any>) =>
  configApi.put(`/menus/${id}`, data).then((r) => r.data.data);
```
