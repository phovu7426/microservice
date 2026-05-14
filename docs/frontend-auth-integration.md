# Tich hop Auth Service — Tai lieu API cho Frontend

> **Base URL:** `/api/auth` (qua Nginx proxy -> auth-service:3001)
>
> Tat ca path ben duoi deu co prefix `/api/auth`. Vi du: `POST /api/auth/login`

---

## Cau truc Response chung

```json
// Thanh cong
{
  "success": true,
  "message": "Success",
  "code": "SUCCESS",
  "httpStatus": 200,
  "data": { ... },
  "meta": {},
  "timestamp": "2026-05-13T10:00:00+07:00"
}

// Loi
{
  "success": false,
  "message": "Mo ta loi",
  "code": "ERROR_CODE",
  "httpStatus": 400,
  "data": null,
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
| Admin | Can JWT co quyen `user.manage` |

---

## Luu y chung

- **Request body va response deu dung camelCase** — `countryId`, `createdAt`, khong phai `country_id`.
- **ID la string** — BigInt serialize thanh string. Gui len phai la numeric string (VD: `"123"`).
- **Token**: luu `accessToken` va `refreshToken` phia client. Gui `Authorization: Bearer {accessToken}` cho moi request can xac thuc.
- **Throttle**: cac endpoint auth co gioi han request/phut de chong brute-force.
- **Enum `status`:** `"active"` | `"inactive"` | `"locked"`.
- **Enum `gender`:** `"male"` | `"female"` | `"other"`.

---

## 1. Dang nhap / Dang ky / OTP

### Public POST `/api/auth/login`

Dang nhap bang email + password. **Throttle: 5 req/60s**

**Request Body:**

```json
{
  "email": "user@example.com",
  "password": "12345678",
  "remember": true
}
```

| Field | Kieu | Bat buoc | Mo ta |
|-------|------|----------|-------|
| `email` | string (email) | Co | Tu dong trim + lowercase |
| `password` | string (6-72) | Co | |
| `remember` | boolean | Khong | `true` -> refresh token TTL dai hon |

**Response `data`:**

```json
{
  "token": "eyJhbGciOi...",
  "refreshToken": "eyJhbGciOi...",
  "expiresIn": 3600
}
```

> **Luu y:** Response login chi tra token, KHONG tra user object. FE can goi them `GET /api/auth/me` de lay thong tin user.

**Loi thuong gap:**
- `401` — Email hoac mat khau khong dung
- `403` — Tai khoan bi khoa
- `429` — Qua nhieu request

---

### Public POST `/api/auth/register/send-otp`

Gui OTP xac thuc email truoc khi dang ky. **Throttle: 2 req/60s**

```json
{ "email": "newuser@example.com" }
```

**Response `data`:**

```json
{ "message": "OTP_SENT" }
```

---

### Public POST `/api/auth/register`

Dang ky tai khoan moi. **Throttle: 5 req/60s**

**Request Body:**

```json
{
  "name": "Nguyen Van A",
  "email": "newuser@example.com",
  "username": "nguyenvana",
  "phone": "+84901234567",
  "password": "MyPass1234",
  "confirmPassword": "MyPass1234",
  "otp": "123456"
}
```

| Field | Kieu | Bat buoc | Mo ta |
|-------|------|----------|-------|
| `name` | string (max 255) | Co | Trim |
| `email` | string (email) | Co | Trim + lowercase |
| `username` | string (3-50) | Khong | Chi `a-z0-9_`, tu dong lowercase |
| `phone` | string | Khong | Format: `+?[0-9]{6,20}` |
| `password` | string (8-72) | Co | |
| `confirmPassword` | string | Co | Phai khop `password` |
| `otp` | string (6 so) | Co | OTP nhan qua email |

**Response `data`:** (HTTP 201)

```json
{
  "user": {
    "id": "2",
    "username": "nguyenvana",
    "email": "newuser@example.com",
    "phone": "+84901234567",
    "name": "Nguyen Van A",
    "image": null,
    "googleId": null,
    "status": "active",
    "emailVerifiedAt": "2026-05-13T10:00:00.000Z",
    "phoneVerifiedAt": null,
    "lastLoginAt": null,
    "createdUserId": null,
    "updatedUserId": null,
    "createdAt": "2026-05-13T10:00:00.000Z",
    "updatedAt": "2026-05-13T10:00:00.000Z",
    "profile": null
  }
}
```

> **Luu y:** Register tra full user object (tru `password` va `rememberToken`).

---

### Public POST `/api/auth/forgot-password/send-otp`

Gui OTP reset password. **Throttle: 2 req/60s**

```json
{ "email": "user@example.com" }
```

**Response `data`:**

```json
{ "message": "OTP_SENT" }
```

Luon tra `200` bat ke email co ton tai hay khong (chong enumeration).

---

### Public POST `/api/auth/reset-password`

Dat lai mat khau bang OTP. **Throttle: 3 req/60s**

```json
{
  "email": "user@example.com",
  "otp": "123456",
  "password": "NewPass1234",
  "confirmPassword": "NewPass1234"
}
```

| Field | Kieu | Bat buoc |
|-------|------|----------|
| `email` | string (email) | Co |
| `otp` | string (6 so) | Co |
| `password` | string (8-72) | Co |
| `confirmPassword` | string | Co — phai khop |

**Response `data`:**

```json
{ "success": true }
```

---

## 2. Token & Session

### Public POST `/api/auth/refresh`

Lam moi access token. **Throttle: 10 req/60s**

```json
{ "refreshToken": "eyJhbGciOi..." }
```

Cung co the gui qua cookie `refresh_token` (khong can body).

**Response `data`:**

```json
{
  "token": "eyJhbGciOi...(moi)",
  "refreshToken": "eyJhbGciOi...(moi)",
  "expiresIn": 3600
}
```

---

### Public POST `/api/auth/logout`

Dang xuat session hien tai.

```json
{ "refreshToken": "eyJhbGciOi..." }
```

Hoac gui qua cookie. Server tu dong xoa cookie `access_token` va `refresh_token`.

**Response `data`:**

```json
{ "success": true }
```

---

### User POST `/api/auth/logout-all`

Thu hoi tat ca session cua user hien tai. Khong can body.

**Response `data`:**

```json
{ "success": true }
```

---

## 3. Thong tin User hien tai

### User GET `/api/auth/me`

Lay thong tin user dang dang nhap.

**Response `data`:**

```json
{
  "id": "1",
  "username": "admin",
  "email": "user@example.com",
  "phone": "+84901234567",
  "name": "Admin User",
  "image": "https://cdn.example.com/avatar.jpg",
  "googleId": null,
  "status": "active",
  "emailVerifiedAt": "2026-01-01T00:00:00.000Z",
  "phoneVerifiedAt": null,
  "lastLoginAt": "2026-05-13T10:00:00.000Z",
  "createdUserId": null,
  "updatedUserId": null,
  "createdAt": "2026-01-01T00:00:00.000Z",
  "updatedAt": "2026-05-13T10:00:00.000Z",
  "profile": {
    "id": "1",
    "userId": "1",
    "birthday": "1990-01-15",
    "gender": "male",
    "address": "123 ABC Street",
    "countryId": "1",
    "provinceId": "2",
    "wardId": "3",
    "about": "Hello world",
    "createdUserId": null,
    "updatedUserId": null,
    "createdAt": "2026-01-01T00:00:00.000Z",
    "updatedAt": "2026-01-01T00:00:00.000Z"
  }
}
```

---

## 4. Profile (User tu quan ly)

### User GET `/api/auth/user/profile`

Lay profile cua minh. Response giong GET /me (full user + profile).

---

### User PATCH `/api/auth/user/profile`

Cap nhat profile. Tat ca field optional — chi gui field can thay doi.

```json
{
  "name": "Nguyen Van B",
  "image": "https://cdn.example.com/new-avatar.jpg",
  "birthday": "1990-01-15",
  "gender": "male",
  "address": "456 DEF Street",
  "countryId": "1",
  "provinceId": "2",
  "wardId": "3",
  "about": "Updated bio"
}
```

| Field | Kieu | Mo ta |
|-------|------|-------|
| `name` | string (max 255) | |
| `image` | string (max 255) | URL avatar |
| `birthday` | string | Format `YYYY-MM-DD` |
| `gender` | `male` \| `female` \| `other` | |
| `countryId` | numeric string (1-20 digits) | |
| `provinceId` | numeric string (1-20 digits) | |
| `wardId` | numeric string (1-20 digits) | |
| `about` | string (max 2000) | |

---

### User PATCH `/api/auth/user/profile/change-password`

Doi mat khau.

```json
{
  "oldPassword": "OldPass1234",
  "password": "NewPass1234",
  "confirmPassword": "NewPass1234"
}
```

**Response `data`:**

```json
{ "success": true }
```

---

## 5. Google OAuth

### Public GET `/api/auth/google`

Redirect den trang dang nhap Google.

### Public GET `/api/auth/google/callback`

Google redirect ve day. Server set cookie va redirect ve FE.

**Luong tich hop:**

```
1. FE: window.location.href = '/api/auth/google'
2. User dang nhap Google
3. Server nhan callback, tao/cap nhat user, set cookies
4. Thanh cong: redirect ve {GOOGLE_FRONTEND_URL}/auth/google/success (set cookie access_token, refresh_token)
5. That bai: redirect ve {GOOGLE_FRONTEND_URL}/login?error={code}
   - error code: bad_request | unauthorized | auth_failed
6. FE doc token tu cookie hoac goi GET /api/auth/me
```

**Cookies duoc set:**
- `access_token` (HttpOnly, Secure)
- `refresh_token` (HttpOnly, Secure)

---

## 6. Quan ly User (Admin)

### Admin GET `/api/auth/admin/users`

Danh sach user co phan trang.

**Query params:**

| Param | Kieu | Mo ta |
|-------|------|-------|
| `email` | string | Loc theo email |
| `phone` | string | Loc theo SDT |
| `status` | `active` \| `inactive` \| `locked` | |
| `skip` | number | Mac dinh `0` |
| `take` | number | Mac dinh `10` |
| `sort` | string | VD: `createdAt` (field sort) |
| `skipCount` | boolean string | `"true"` -> bo qua dem tong |

**Response `data`:**

```json
[
  {
    "id": "1",
    "username": "admin",
    "email": "user@example.com",
    "phone": "+84901234567",
    "name": "Admin User",
    "image": null,
    "status": "active",
    "createdAt": "2026-01-01T00:00:00.000Z",
    "lastLoginAt": "2026-05-13T10:00:00.000Z"
  }
]
```

**Response `meta`:**

```json
{
  "total": 100,
  "skip": 0,
  "take": 10,
  "pageCount": 10,
  "pageNumber": 1
}
```

---

### Admin GET `/api/auth/admin/users/simple`

Danh sach rut gon — dung cho dropdown. Max 200 records.

**Response `data[i]`:**

```json
{
  "id": "1",
  "name": "Admin User",
  "email": "user@example.com",
  "image": null,
  "status": "active"
}
```

---

### Admin GET `/api/auth/admin/users/:id`

Chi tiet user (bao gom profile).

**Response `data`:**

```json
{
  "id": "1",
  "username": "admin",
  "email": "user@example.com",
  "phone": "+84901234567",
  "name": "Admin User",
  "image": null,
  "googleId": null,
  "status": "active",
  "emailVerifiedAt": "2026-01-01T00:00:00.000Z",
  "phoneVerifiedAt": null,
  "lastLoginAt": "2026-05-13T10:00:00.000Z",
  "createdUserId": null,
  "updatedUserId": null,
  "createdAt": "2026-01-01T00:00:00.000Z",
  "updatedAt": "2026-05-13T10:00:00.000Z",
  "profile": {
    "id": "1",
    "userId": "1",
    "birthday": "1990-01-15",
    "gender": "male",
    "address": "123 ABC Street",
    "countryId": "1",
    "provinceId": "2",
    "wardId": "3",
    "about": "Hello world",
    "createdUserId": null,
    "updatedUserId": null,
    "createdAt": "2026-01-01T00:00:00.000Z",
    "updatedAt": "2026-01-01T00:00:00.000Z"
  }
}
```

---

### Admin POST `/api/auth/admin/users`

Tao user moi. (HTTP 201)

```json
{
  "email": "new@example.com",
  "username": "newuser",
  "phone": "+84901234567",
  "password": "Pass1234",
  "name": "New User",
  "image": "https://...",
  "profile": {
    "birthday": "1995-06-15",
    "gender": "female",
    "address": "...",
    "countryId": "1",
    "provinceId": "2",
    "wardId": "3",
    "about": "..."
  }
}
```

| Field | Kieu | Bat buoc |
|-------|------|----------|
| `password` | string (6-72) | Co |
| `email` | email | Khong |
| `username` | string (max 50) | Khong |
| `phone` | string (max 20) | Khong |
| `name` | string (max 255) | Khong |
| `image` | string (max 255) | Khong |
| `profile` | object | Khong |

---

### Admin PUT `/api/auth/admin/users/:id`

Cap nhat user. Giong POST, tat ca optional (ke ca `password`).

---

### Admin DELETE `/api/auth/admin/users/:id`

Xoa user.

**Response `data`:**

```json
{ "success": true }
```

---

### Admin PATCH `/api/auth/admin/users/:id/password`

Admin doi mat khau user.

```json
{ "password": "NewPass1234" }
```

| Field | Kieu | Bat buoc |
|-------|------|----------|
| `password` | string (6-72) | Co |

**Response `data`:**

```json
{ "success": true }
```

---

### Admin PATCH `/api/auth/admin/users/:id/status`

Doi trang thai user.

```json
{ "status": "active" }
```

| Field | Kieu | Bat buoc |
|-------|------|----------|
| `status` | `active` \| `inactive` \| `locked` | Co |

**Response `data`:**

```json
{ "success": true }
```

---

## Luong tich hop tieu bieu

### Dang ky

```
1. POST /api/auth/register/send-otp   ->  { email }
2. User nhan OTP qua email
3. POST /api/auth/register             ->  { name, email, password, confirmPassword, otp }
4. Luu token, redirect trang chu
```

### Dang nhap

```
1. POST /api/auth/login                ->  { email, password }
2. Nhan { token, refreshToken, expiresIn } — KHONG co user
3. Luu accessToken + refreshToken
4. GET /api/auth/me                    ->  Lay thong tin user
5. Gui header: Authorization: Bearer {accessToken}
```

### Refresh token

```
1. Khi nhan 401 Unauthorized
2. POST /api/auth/refresh              ->  { refreshToken }
3. Luu token moi, retry request goc
4. Neu refresh cung 401 -> redirect login
```

### Quen mat khau

```
1. POST /api/auth/forgot-password/send-otp  ->  { email }
2. User nhan OTP qua email
3. POST /api/auth/reset-password            ->  { email, otp, password, confirmPassword }
4. Redirect login
```

---

## 7. Enum (Danh sach gia tri)

### Public GET `/api/auth/users/enums/:key`

Lay danh sach gia tri enum de hien thi dropdown / label. **Khong can dang nhap.**

| Key | Mo ta | Gia tri |
|-----|-------|---------|
| `genders` | Gioi tinh | `male`, `female`, `other` |
| `statuses` | Trang thai user | `active`, `inactive`, `locked` |

**Vi du request:**

```
GET /api/auth/users/enums/genders
GET /api/auth/users/enums/statuses
```

**Response `data`:**

```json
[
  { "value": "male", "label": "Nam" },
  { "value": "female", "label": "Nu" },
  { "value": "other", "label": "Khac" }
]
```

> Dung de hien thi label tieng Viet trong dropdown thay vi hien thi raw enum value.

---

## Tong hop endpoint

| Method | Path | Auth | Mo ta |
|--------|------|------|-------|
| POST | `/api/auth/login` | Public | Dang nhap |
| POST | `/api/auth/register` | Public | Dang ky |
| POST | `/api/auth/register/send-otp` | Public | Gui OTP dang ky |
| POST | `/api/auth/logout` | Public | Dang xuat |
| POST | `/api/auth/logout-all` | User | Dang xuat tat ca |
| POST | `/api/auth/refresh` | Public | Lam moi token |
| GET | `/api/auth/me` | User | Thong tin user |
| POST | `/api/auth/forgot-password/send-otp` | Public | Gui OTP quen MK |
| POST | `/api/auth/reset-password` | Public | Dat lai MK |
| GET | `/api/auth/google` | Public | OAuth Google |
| GET | `/api/auth/google/callback` | Public | Callback OAuth |
| GET | `/api/auth/user/profile` | User | Lay profile |
| PATCH | `/api/auth/user/profile` | User | Cap nhat profile |
| PATCH | `/api/auth/user/profile/change-password` | User | Doi mat khau |
| GET | `/api/auth/admin/users` | Admin | Danh sach user |
| GET | `/api/auth/admin/users/simple` | Admin | DS rut gon |
| GET | `/api/auth/admin/users/:id` | Admin | Chi tiet user |
| POST | `/api/auth/admin/users` | Admin | Tao user |
| PUT | `/api/auth/admin/users/:id` | Admin | Cap nhat user |
| DELETE | `/api/auth/admin/users/:id` | Admin | Xoa user |
| PATCH | `/api/auth/admin/users/:id/password` | Admin | Doi MK user |
| PATCH | `/api/auth/admin/users/:id/status` | Admin | Doi trang thai |
| GET | `/api/auth/users/enums/genders` | Public | Enum gioi tinh |
| GET | `/api/auth/users/enums/statuses` | Public | Enum trang thai user |
