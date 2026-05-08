# Tich hop Authentication vao Frontend

> Base URL: `/api/auth` (qua Nginx proxy den auth-service:3001)

---

## Muc luc

1. [Dang nhap (Login)](#1-dang-nhap-login)
2. [Dang ky (Register)](#2-dang-ky-register)
3. [Lam moi token (Refresh Token)](#3-lam-moi-token-refresh-token)
4. [Dang xuat (Logout)](#4-dang-xuat-logout)
5. [Quen mat khau (Forgot Password)](#5-quen-mat-khau-forgot-password)
6. [Dang nhap Google (OAuth)](#6-dang-nhap-google-oauth)
7. [Lay thong tin user hien tai](#7-lay-thong-tin-user-hien-tai)
8. [Cap nhat profile](#8-cap-nhat-profile)
9. [Doi mat khau](#9-doi-mat-khau)
10. [Cach luu token va gui request](#10-cach-luu-token-va-gui-request)
11. [Xu ly loi](#11-xu-ly-loi)
12. [Code mau (Axios)](#12-code-mau-axios)

---

## 1. Dang nhap (Login)

### Request

```
POST /api/auth/login
Content-Type: application/json
```

```json
{
  "email": "user@example.com",
  "password": "matkhau123",
  "remember": true
}
```

| Field      | Type    | Bat buoc | Mo ta                          |
|------------|---------|----------|--------------------------------|
| `email`    | string  | Co       | Email hop le, tu dong lowercase |
| `password` | string  | Co       | 6-72 ky tu                     |
| `remember` | boolean | Khong    | Ghi nho dang nhap              |

### Response thanh cong (200)

```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJSUzI1NiIs...",
    "refreshToken": "eyJhbGciOiJSUzI1NiIs...",
    "expiresIn": 3600
  },
  "timestamp": "2026-05-08T10:00:00.000Z"
}
```

| Field          | Type   | Mo ta                                       |
|----------------|--------|---------------------------------------------|
| `token`        | string | Access token (JWT RS256), dung de goi API   |
| `refreshToken` | string | Refresh token, dung de lam moi access token |
| `expiresIn`    | number | Thoi gian song cua access token (giay). Mac dinh: **3600** (1 gio) |

> **Luu y:** Server dong thoi set 2 cookie HttpOnly (`token` va `refreshToken`). Neu FE dung cookie thi khong can luu token thu cong.

### Response loi

| HTTP Status | Khi nao                                     |
|-------------|---------------------------------------------|
| 400         | Thieu field, email khong hop le             |
| 401         | Sai email hoac mat khau                     |
| 403         | Tai khoan bi khoa (qua nhieu lan dang nhap sai) |
| 429         | Vuot gioi han 5 request/60 giay             |

---

## 2. Dang ky (Register)

### Buoc 1: Gui OTP xac thuc email

```
POST /api/auth/register/send-otp
Content-Type: application/json
```

```json
{
  "email": "user@example.com"
}
```

**Response (200):**

```json
{
  "success": true,
  "data": {
    "message": "OTP da duoc gui"
  }
}
```

> OTP gui qua email, co hieu luc **5 phut**. Gioi han **2 request/60 giay**.

### Buoc 2: Dang ky voi OTP

```
POST /api/auth/register
Content-Type: application/json
```

```json
{
  "name": "Nguyen Van A",
  "username": "nguyenvana",
  "email": "user@example.com",
  "phone": "+84901234567",
  "password": "matkhau123",
  "confirmPassword": "matkhau123",
  "otp": "123456"
}
```

| Field             | Type   | Bat buoc | Mo ta                                     |
|-------------------|--------|----------|-------------------------------------------|
| `name`            | string | Co       | Ten hien thi, toi da 255 ky tu            |
| `username`        | string | Khong    | 3-50 ky tu, chi a-z, 0-9, _ (underscore) |
| `email`           | string | Co       | Email da gui OTP                          |
| `phone`           | string | Khong    | 6-20 so, cho phep tien to +               |
| `password`        | string | Co       | 8-72 ky tu                                |
| `confirmPassword` | string | Co       | Phai trung voi password                   |
| `otp`             | string | Co       | Ma OTP 6 so nhan tu email                 |

**Response thanh cong (201):**

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "1",
      "email": "user@example.com",
      "username": "nguyenvana",
      "name": "Nguyen Van A",
      "phone": "+84901234567",
      "status": "active",
      "created_at": "2026-05-08T10:00:00.000Z"
    }
  }
}
```

> Sau khi dang ky thanh cong, FE chuyen sang trang login de dang nhap.

---

## 3. Lam moi token (Refresh Token)

Khi access token het han (mac dinh 1 gio), dung refresh token de lay token moi **ma khong can dang nhap lai**.

### Request

```
POST /api/auth/refresh
Content-Type: application/json
```

```json
{
  "refreshToken": "eyJhbGciOiJSUzI1NiIs..."
}
```

Hoac neu dung cookie (khong can gui body):

```
POST /api/auth/refresh
Cookie: refreshToken=eyJhbGciOiJSUzI1NiIs...
```

### Response thanh cong (200)

```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJSUzI1NiIs...(token moi)",
    "refreshToken": "eyJhbGciOiJSUzI1NiIs...(refresh token moi)",
    "expiresIn": 3600
  }
}
```

### Co che Refresh Token Rotation

- Moi lan refresh, **ca access token va refresh token deu duoc cap moi**.
- Refresh token cu **bi vo hieu hoa ngay lap tuc**.
- Neu refresh token cu bi su dung lai (reuse detection) → **TAT CA session cua user bi logout** (bao ve chong tan cong).

### Response loi

| HTTP Status | Khi nao                                          |
|-------------|--------------------------------------------------|
| 401         | Refresh token het han, khong hop le, hoac bi reuse |
| 429         | Vuot gioi han 10 request/60 giay                 |

### Thoi gian song

| Token          | Mac dinh | Cau hinh server         |
|----------------|----------|-------------------------|
| Access token   | 1 gio    | `JWT_EXPIRES_IN=1h`     |
| Refresh token  | 7 ngay   | `JWT_REFRESH_EXPIRES_IN=7d` |

---

## 4. Dang xuat (Logout)

### Logout thiet bi hien tai

```
POST /api/auth/logout
Content-Type: application/json
Authorization: Bearer <access_token>   (khong bat buoc)
```

```json
{
  "refreshToken": "eyJhbGciOiJSUzI1NiIs..."
}
```

> Gui ca access token (qua header) va refresh token (qua body hoac cookie) de dam bao vo hieu hoa ca hai.

**Response (200):**

```json
{
  "success": true,
  "data": {
    "success": true
  }
}
```

### Logout tat ca thiet bi

```
POST /api/auth/logout-all
Authorization: Bearer <access_token>
```

> Yeu cau dang nhap. Vo hieu hoa **tat ca** refresh token cua user tren moi thiet bi.

---

## 5. Quen mat khau (Forgot Password)

### Buoc 1: Gui OTP

```
POST /api/auth/forgot-password/send-otp
Content-Type: application/json
```

```json
{
  "email": "user@example.com"
}
```

**Response (200):** `{ "success": true, "data": { "message": "OTP da duoc gui" } }`

> Gioi han **2 request/60 giay**. OTP co hieu luc **5 phut**.

### Buoc 2: Dat lai mat khau

```
POST /api/auth/reset-password
Content-Type: application/json
```

```json
{
  "email": "user@example.com",
  "otp": "123456",
  "password": "matkhaumoi123",
  "confirmPassword": "matkhaumoi123"
}
```

| Field             | Type   | Bat buoc | Mo ta                     |
|-------------------|--------|----------|---------------------------|
| `email`           | string | Co       | Email da gui OTP          |
| `otp`             | string | Co       | Ma OTP 6 so               |
| `password`        | string | Co       | Mat khau moi, 8-72 ky tu  |
| `confirmPassword` | string | Co       | Xac nhan mat khau moi     |

**Response (200):** `{ "success": true, "data": { "success": true } }`

> Sau khi reset thanh cong, **tat ca session cu bi vo hieu hoa**. User phai dang nhap lai.

---

## 6. Dang nhap Google (OAuth)

### Flow

```
                        Frontend                              Backend
                           |                                     |
    1. User click     ─────┤                                     |
       "Dang nhap Google"  |                                     |
                           |── GET /api/auth/google ────────────>|
                           |                                     |── Redirect to Google ──>
                           |                                     |
                           |<── Google consent screen ───────────|
                           |                                     |
    2. User dong y    ─────┤                                     |
                           |── Google callback ─────────────────>|
                           |                                     |── GET /api/auth/google/callback
                           |                                     |   (xu ly token, tao/cap nhat user)
                           |                                     |
    3. Redirect ve FE ─────┤<── 302 Redirect ───────────────────|
                           |    /auth/google/success              |
                           |    (cookie chua token)               |
                           |                                     |
    4. FE doc cookie  ─────┤                                     |
       hoac call /me       |                                     |
```

### Cach tich hop

**1. Tao nut "Dang nhap voi Google":**

```html
<a href="/api/auth/google">Dang nhap voi Google</a>
```

Hoac redirect bang JS:

```javascript
window.location.href = '/api/auth/google';
```

**2. Tao trang callback `/auth/google/success`:**

```javascript
// pages/auth/google/success.tsx (Next.js vi du)
export default function GoogleSuccess() {
  useEffect(() => {
    // Token da duoc set trong cookie boi server
    // Goi /api/auth/me de lay thong tin user
    fetchUserInfo().then(user => {
      // Luu user vao state/store
      router.push('/');
    });
  }, []);

  return <div>Dang xu ly dang nhap...</div>;
}
```

**3. Xu ly loi:**

Khi loi, server redirect ve: `/login?error={error_code}`

```javascript
// Trang login, doc query param
const error = searchParams.get('error');
if (error) {
  const messages = {
    'ACCOUNT_LINKED_TO_OTHER': 'Email nay da lien ket voi tai khoan khac',
    'ACCOUNT_LOCKED': 'Tai khoan bi khoa',
    'GOOGLE_AUTH_FAILED': 'Dang nhap Google that bai',
  };
  showError(messages[error] || 'Co loi xay ra');
}
```

---

## 7. Lay thong tin user hien tai

### GET /api/auth/me

```
GET /api/auth/me
Authorization: Bearer <access_token>
```

**Response (200):**

```json
{
  "success": true,
  "data": {
    "id": "1",
    "email": "user@example.com",
    "username": "nguyenvana",
    "name": "Nguyen Van A",
    "phone": "+84901234567",
    "image": "https://storage.example.com/avatar.jpg",
    "status": "active",
    "created_at": "2026-05-08T10:00:00.000Z",
    "email_verified_at": "2026-05-08T10:01:00.000Z",
    "last_login_at": "2026-05-08T12:00:00.000Z",
    "profile": {
      "birthday": "1990-01-15",
      "gender": "male",
      "address": "123 Nguyen Hue, Q1",
      "country_id": "1",
      "province_id": "79",
      "ward_id": "123",
      "about": "Toi thich doc truyen tranh"
    }
  }
}
```

> Dung endpoint nay sau khi login/refresh de lay thong tin user moi nhat.

---

## 8. Cap nhat profile

```
PATCH /api/auth/user/profile
Authorization: Bearer <access_token>
Content-Type: application/json
```

```json
{
  "name": "Nguyen Van B",
  "image": "https://storage.example.com/new-avatar.jpg",
  "birthday": "1990-01-15",
  "gender": "male",
  "address": "456 Le Loi, Q3",
  "country_id": "1",
  "province_id": "79",
  "ward_id": "456",
  "about": "Bio moi cua toi"
}
```

| Field         | Type   | Bat buoc | Mo ta                  |
|---------------|--------|----------|------------------------|
| `name`        | string | Khong    | Toi da 255 ky tu       |
| `image`       | string | Khong    | URL avatar, toi da 255 |
| `birthday`    | string | Khong    | Dinh dang YYYY-MM-DD   |
| `gender`      | string | Khong    | Toi da 20 ky tu        |
| `address`     | string | Khong    | Dia chi                |
| `country_id`  | string | Khong    | Ma quoc gia            |
| `province_id` | string | Khong    | Ma tinh/thanh          |
| `ward_id`     | string | Khong    | Ma phuong/xa           |
| `about`       | string | Khong    | Gioi thieu, toi da 2000 ky tu |

> Chi gui nhung field can cap nhat (PATCH).

---

## 9. Doi mat khau

```
PATCH /api/auth/user/profile/change-password
Authorization: Bearer <access_token>
Content-Type: application/json
```

```json
{
  "old_password": "matkhaucu123",
  "password": "matkhaumoi123",
  "confirmPassword": "matkhaumoi123"
}
```

| Field             | Type   | Bat buoc | Mo ta                    |
|-------------------|--------|----------|--------------------------|
| `old_password`    | string | Co       | Mat khau hien tai        |
| `password`        | string | Co       | Mat khau moi, 8-72 ky tu |
| `confirmPassword` | string | Co       | Xac nhan mat khau moi    |

---

## 10. Cach luu token va gui request

### Phuong an 1: Dung Cookie (Khuyen nghi)

Server tu dong set cookie HttpOnly khi login/refresh. FE chi can dam bao:

```javascript
// Axios: gui cookie tu dong
axios.defaults.withCredentials = true;

// Fetch API:
fetch('/api/auth/me', { credentials: 'include' });
```

**Uu diem:** An toan hon (JS khong doc duoc token), tu dong gui moi request.

### Phuong an 2: Luu token trong memory/state

```javascript
// Luu token sau khi login
const { token, refreshToken, expiresIn } = response.data.data;

// Luu vao state (KHONG luu localStorage de tranh XSS)
authStore.setToken(token);
authStore.setRefreshToken(refreshToken);
authStore.setExpiresAt(Date.now() + expiresIn * 1000);

// Gui request voi Authorization header
axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
```

---

## 11. Xu ly loi

### Format loi chuan

```json
{
  "success": false,
  "statusCode": 401,
  "message": "Unauthorized",
  "error": "Email hoac mat khau khong dung",
  "timestamp": "2026-05-08T10:00:00.000Z"
}
```

### Bang ma loi thuong gap

| Status | Endpoint          | Y nghia                                  | FE xu ly                          |
|--------|-------------------|------------------------------------------|-----------------------------------|
| 400    | Tat ca            | Du lieu gui len khong hop le             | Hien thi loi validation           |
| 401    | Login             | Sai email/mat khau                       | Hien thong bao sai thong tin      |
| 401    | API bat ky        | Token het han hoac khong hop le          | Goi refresh, neu fail thi logout  |
| 403    | Login             | Tai khoan bi khoa (brute force)          | Hien "Thu lai sau 30 phut"        |
| 403    | API bat ky        | Khong co quyen truy cap                  | Hien "Khong co quyen"             |
| 409    | Register          | Email/username/phone da ton tai          | Hien "Tai khoan da ton tai"       |
| 429    | Tat ca            | Gui request qua nhieu                    | Hien "Vui long thu lai sau"       |

---

## 12. Code mau (Axios)

### Cau hinh Axios voi auto refresh token

```typescript
import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  withCredentials: true, // Gui cookie tu dong
});

// ── State ────────────────────────────────────────
let accessToken: string | null = null;
let refreshToken: string | null = null;
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (error: any) => void;
}> = [];

// ── Xu ly queue khi dang refresh ─────────────────
function processQueue(error: any, token: string | null = null) {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error);
    else resolve(token!);
  });
  failedQueue = [];
}

// ── Request interceptor: gan token vao header ────
api.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

// ── Response interceptor: tu dong refresh khi 401 ─
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Chi xu ly 401 va chua retry
    if (error.response?.status !== 401 || originalRequest._retry) {
      return Promise.reject(error);
    }

    // Neu dang refresh, xep hang cho
    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      }).then((token) => {
        originalRequest.headers.Authorization = `Bearer ${token}`;
        return api(originalRequest);
      });
    }

    originalRequest._retry = true;
    isRefreshing = true;

    try {
      const { data } = await axios.post('/api/auth/refresh', {
        refreshToken, // Hoac de trong neu dung cookie
      }, { withCredentials: true });

      accessToken = data.data.token;
      refreshToken = data.data.refreshToken;

      processQueue(null, accessToken);

      originalRequest.headers.Authorization = `Bearer ${accessToken}`;
      return api(originalRequest);
    } catch (refreshError) {
      processQueue(refreshError, null);

      // Refresh that bai → buoc logout
      accessToken = null;
      refreshToken = null;
      window.location.href = '/login';

      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  }
);

// ── Ham login ────────────────────────────────────
export async function login(email: string, password: string) {
  const { data } = await api.post('/auth/login', { email, password });
  accessToken = data.data.token;
  refreshToken = data.data.refreshToken;
  return data.data;
}

// ── Ham logout ───────────────────────────────────
export async function logout() {
  try {
    await api.post('/auth/logout', { refreshToken });
  } finally {
    accessToken = null;
    refreshToken = null;
    window.location.href = '/login';
  }
}

// ── Ham lay user info ────────────────────────────
export async function getMe() {
  const { data } = await api.get('/auth/me');
  return data.data;
}

export default api;
```

### Su dung trong React component

```tsx
import { useEffect, useState } from 'react';
import api, { login, logout, getMe } from '@/lib/api';

// ── Login form ───────────────────────────────────
function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await login(email, password);
      const user = await getMe();
      // Luu user vao context/store
      router.push('/');
    } catch (err: any) {
      if (err.response?.status === 401) {
        setError('Email hoac mat khau khong dung');
      } else if (err.response?.status === 403) {
        setError('Tai khoan bi khoa. Vui long thu lai sau');
      } else if (err.response?.status === 429) {
        setError('Ban da thu qua nhieu lan. Vui long doi');
      } else {
        setError('Co loi xay ra, vui long thu lai');
      }
    }
  };

  return (
    <form onSubmit={handleLogin}>
      <input value={email} onChange={e => setEmail(e.target.value)} />
      <input type="password" value={password} onChange={e => setPassword(e.target.value)} />
      {error && <p className="text-red-500">{error}</p>}
      <button type="submit">Dang nhap</button>
    </form>
  );
}
```

### Dang ky (2 buoc)

```typescript
// Buoc 1: Gui OTP
async function sendRegisterOtp(email: string) {
  const { data } = await api.post('/auth/register/send-otp', { email });
  return data.data; // { message: 'OTP da duoc gui' }
}

// Buoc 2: Dang ky voi OTP
async function register(payload: {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
  otp: string;
  username?: string;
  phone?: string;
}) {
  const { data } = await api.post('/auth/register', payload);
  return data.data; // { user: { id, email, name, ... } }
}
```

### Quen mat khau (2 buoc)

```typescript
// Buoc 1: Gui OTP
async function sendForgotPasswordOtp(email: string) {
  await api.post('/auth/forgot-password/send-otp', { email });
}

// Buoc 2: Reset mat khau
async function resetPassword(payload: {
  email: string;
  otp: string;
  password: string;
  confirmPassword: string;
}) {
  await api.post('/auth/reset-password', payload);
  // Thanh cong → chuyen ve trang login
}
```

---

## So do tong quan flow

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   ┌──────────┐    POST /login     ┌──────────────────────┐     │
│   │  Login   │ ──────────────────>│   Luu access token   │     │
│   │  Form    │ <──────────────────│   + refresh token    │     │
│   └──────────┘   {token,          └──────┬───────────────┘     │
│                   refreshToken,          │                      │
│                   expiresIn}             │ Moi request          │
│                                          ▼                      │
│                                   Authorization:                │
│                                   Bearer <token>                │
│                                          │                      │
│                                          ▼                      │
│                                   ┌──────────────┐              │
│                              ┌────│   API Call    │              │
│                              │    └──────┬───────┘              │
│                              │           │                      │
│                         200 OK      401 Unauthorized             │
│                              │           │                      │
│                              ▼           ▼                      │
│                        ┌────────┐  ┌─────────────┐              │
│                        │  Done  │  │ POST /refresh│              │
│                        └────────┘  └──────┬──────┘              │
│                                           │                     │
│                                     ┌─────┴─────┐              │
│                                     │           │               │
│                                  200 OK      401               │
│                                     │           │               │
│                                     ▼           ▼               │
│                               Retry request   Logout            │
│                               voi token moi   → /login          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Luu y bao mat

1. **KHONG luu token vao `localStorage`** — de bi tan cong XSS. Dung cookie HttpOnly hoac luu trong memory/state.
2. **Luon gui `withCredentials: true`** khi dung cookie.
3. **Refresh token chi duoc dung 1 lan** — sau khi refresh, token cu bi vo hieu hoa ngay.
4. **Neu refresh token bi reuse** (vi du attacker danh cap) → server tu dong logout tat ca session.
5. **Rate limiting** ap dung cho tat ca endpoint auth — khong gui request lien tuc.
6. **OTP chi co hieu luc 5 phut** va chi dung duoc 1 lan.
7. **Sau 5 lan dang nhap sai** → tai khoan bi khoa 30 phut.
