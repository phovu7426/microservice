# Tich hop General Config vao Frontend

> Base URL: `/api/config` (qua Nginx proxy den config-service:3003)

---

## Muc luc

1. [Tong quan](#1-tong-quan)
2. [Lay General Config (Public)](#2-lay-general-config-public)
3. [Cap nhat General Config (Admin)](#3-cap-nhat-general-config-admin)
4. [Cau truc du lieu chi tiet](#4-cau-truc-du-lieu-chi-tiet)
5. [Contact Channels](#5-contact-channels)
6. [Caching va hieu nang](#6-caching-va-hieu-nang)
7. [Code mau tich hop](#7-code-mau-tich-hop)
8. [Xu ly loi](#8-xu-ly-loi)

---

## 1. Tong quan

General Config luu cau hinh chung cua website: ten site, logo, SEO, analytics, thong tin lien he... Chi co **1 ban ghi duy nhat** trong database — khong co list, chi co get va update.

| Endpoint             | Method | Auth              | Mo ta                    |
|----------------------|--------|-------------------|--------------------------|
| `/api/config/general` | GET    | Khong can (Public) | Lay cau hinh hien tai    |
| `/api/config/general` | PUT    | `config.manage`    | Cap nhat cau hinh (Admin) |

---

## 2. Lay General Config (Public)

Frontend goi endpoint nay khi khoi tao app de lay thong tin site.

### Request

```
GET /api/config/general
```

Khong can header, khong can token, khong can tham so.

### Response (200)

```json
{
  "success": true,
  "data": {
    "id": "1",
    "site_name": "TruyenHay",
    "site_description": "Nen tang doc truyen tranh hang dau",
    "site_logo": "https://storage.example.com/logo.png",
    "site_favicon": "https://storage.example.com/favicon.ico",
    "site_email": "contact@truyenhay.com",
    "site_phone": "0901234567",
    "site_address": "123 Nguyen Hue, Quan 1, TP.HCM",
    "site_country_id": "1",
    "site_province_id": "79",
    "site_ward_id": "123",
    "site_copyright": "© 2026 TruyenHay. All rights reserved.",
    "timezone": "Asia/Ho_Chi_Minh",
    "locale": "vi",
    "currency": "VND",
    "contact_channels": [
      {
        "type": "email",
        "value": "support@truyenhay.com",
        "label": "Email ho tro",
        "icon": "mail",
        "url_template": "mailto:support@truyenhay.com",
        "enabled": true,
        "sort_order": 1
      },
      {
        "type": "facebook",
        "value": "truyenhay",
        "label": "Facebook",
        "icon": "facebook",
        "url_template": "https://fb.com/truyenhay",
        "enabled": true,
        "sort_order": 2
      }
    ],
    "meta_title": "TruyenHay - Doc truyen tranh online",
    "meta_keywords": "truyen tranh, manga, manhwa, manhua",
    "og_title": "TruyenHay - Doc truyen tranh online",
    "og_description": "Nen tang doc truyen tranh mien phi",
    "og_image": "https://storage.example.com/og-image.jpg",
    "canonical_url": "https://truyenhay.com",
    "google_analytics_id": "G-XXXXXXXXXX",
    "google_search_console": "abcdef123456",
    "facebook_pixel_id": "1234567890",
    "twitter_site": "@truyenhay",
    "created_at": "2026-01-01T00:00:00.000Z",
    "updated_at": "2026-05-08T10:00:00.000Z"
  },
  "timestamp": "2026-05-09T10:00:00.000Z"
}
```

### Bang mo ta cac field

#### Thong tin co ban

| Field              | Type         | Mo ta                        | Mac dinh           |
|--------------------|--------------|------------------------------|--------------------|
| `id`               | string       | ID ban ghi                   | —                  |
| `site_name`        | string       | Ten website                  | `"My Website"`     |
| `site_description` | string\|null | Mo ta website                | null               |
| `site_logo`        | string\|null | URL logo                     | null               |
| `site_favicon`     | string\|null | URL favicon                  | null               |
| `site_email`       | string\|null | Email lien he                | null               |
| `site_phone`       | string\|null | So dien thoai lien he        | null               |
| `site_address`     | string\|null | Dia chi                      | null               |
| `site_country_id`  | string\|null | ID quoc gia                  | null               |
| `site_province_id` | string\|null | ID tinh/thanh pho            | null               |
| `site_ward_id`     | string\|null | ID phuong/xa                 | null               |
| `site_copyright`   | string\|null | Dong copyright               | null               |

#### Cau hinh he thong

| Field      | Type   | Mo ta            | Mac dinh             |
|------------|--------|------------------|----------------------|
| `timezone` | string | Mui gio          | `"Asia/Ho_Chi_Minh"` |
| `locale`   | string | Ngon ngu         | `"vi"`               |
| `currency` | string | Don vi tien te   | `"VND"`              |

#### SEO & Meta

| Field                    | Type         | Mo ta                       |
|--------------------------|--------------|-----------------------------|
| `meta_title`             | string\|null | Tieu de trang (title tag)   |
| `meta_keywords`          | string\|null | Tu khoa SEO                 |
| `og_title`               | string\|null | Tieu de Open Graph          |
| `og_description`         | string\|null | Mo ta Open Graph            |
| `og_image`               | string\|null | Hinh anh Open Graph         |
| `canonical_url`          | string\|null | Canonical URL               |

#### Analytics & Tracking

| Field                    | Type         | Mo ta                       |
|--------------------------|--------------|-----------------------------|
| `google_analytics_id`    | string\|null | Google Analytics ID (G-xxx) |
| `google_search_console`  | string\|null | Google Search Console       |
| `facebook_pixel_id`      | string\|null | Facebook Pixel ID           |
| `twitter_site`           | string\|null | Twitter handle (@xxx)       |

#### Lien he

| Field              | Type  | Mo ta                                          |
|--------------------|-------|------------------------------------------------|
| `contact_channels` | array | Danh sach kenh lien he (luon la array, khong bao gio null) |

---

## 3. Cap nhat General Config (Admin)

### Request

```
PUT /api/config/general
Content-Type: application/json
Authorization: Bearer <access_token>
```

> Yeu cau quyen `config.manage`.

Chi gui nhung field can cap nhat (cac field khong gui se giu nguyen gia tri cu):

```json
{
  "site_name": "TruyenHay",
  "site_description": "Mo ta moi",
  "site_logo": "https://storage.example.com/new-logo.png",
  "site_favicon": "https://storage.example.com/favicon.ico",
  "site_email": "admin@truyenhay.com",
  "site_phone": "0901234567",
  "site_address": "456 Le Loi, Q1, TP.HCM",
  "site_country_id": "1",
  "site_province_id": "79",
  "site_ward_id": "456",
  "site_copyright": "© 2026 TruyenHay",
  "timezone": "Asia/Ho_Chi_Minh",
  "locale": "vi",
  "currency": "VND",
  "contact_channels": [
    {
      "type": "email",
      "value": "support@truyenhay.com",
      "label": "Email ho tro",
      "icon": "mail",
      "url_template": "mailto:support@truyenhay.com",
      "enabled": true,
      "sort_order": 1
    }
  ],
  "meta_title": "TruyenHay - Tieu de SEO",
  "meta_keywords": "truyen tranh, manga",
  "og_title": "TruyenHay",
  "og_description": "Mo ta OG",
  "og_image": "https://storage.example.com/og.jpg",
  "canonical_url": "https://truyenhay.com",
  "google_analytics_id": "G-XXXXXXXXXX",
  "facebook_pixel_id": "1234567890",
  "twitter_site": "@truyenhay"
}
```

### Validation

| Field              | Rang buoc                                     |
|--------------------|-----------------------------------------------|
| `site_name`        | Toi da 255 ky tu                              |
| `site_logo`        | URL hop le (http/https), toi da 500 ky tu     |
| `site_favicon`     | URL hop le (http/https), toi da 500 ky tu     |
| `site_email`       | Email hop le, toi da 255 ky tu                |
| `site_phone`       | Toi da 20 ky tu                               |
| `site_copyright`   | Toi da 255 ky tu                              |
| `timezone`         | Toi da 50 ky tu                               |
| `locale`           | Toi da 10 ky tu                               |
| `currency`         | Toi da 10 ky tu                               |
| `site_country_id`  | Chuoi so (regex `/^\d{1,20}$/`)               |
| `site_province_id` | Chuoi so (regex `/^\d{1,20}$/`)               |
| `site_ward_id`     | Chuoi so (regex `/^\d{1,20}$/`)               |
| `og_image`         | URL hop le (http/https), toi da 500 ky tu     |
| `canonical_url`    | URL hop le (http/https), toi da 500 ky tu     |
| `meta_title`       | Toi da 255 ky tu                              |
| `og_title`         | Toi da 255 ky tu                              |
| `google_analytics_id` | Toi da 50 ky tu                            |
| `facebook_pixel_id`   | Toi da 50 ky tu                            |
| `twitter_site`        | Toi da 50 ky tu                            |

### Response thanh cong (200)

Tra ve object config da cap nhat (cung cau truc nhu GET).

### Response loi

| HTTP Status | Khi nao                                   |
|-------------|-------------------------------------------|
| 400         | Du lieu khong hop le (validation fail)    |
| 401         | Chua dang nhap                            |
| 403         | Khong co quyen `config.manage`            |
| 500         | Loi server khi luu config                 |

---

## 4. Cau truc du lieu chi tiet

### TypeScript Interfaces

```typescript
// ── General Config ──────────────────────────────
interface GeneralConfig {
  id: string;

  // Thong tin site
  site_name: string;
  site_description: string | null;
  site_logo: string | null;
  site_favicon: string | null;
  site_email: string | null;
  site_phone: string | null;
  site_address: string | null;
  site_country_id: string | null;
  site_province_id: string | null;
  site_ward_id: string | null;
  site_copyright: string | null;

  // Cau hinh
  timezone: string;   // "Asia/Ho_Chi_Minh"
  locale: string;     // "vi"
  currency: string;   // "VND"

  // Lien he
  contact_channels: ContactChannel[];

  // SEO
  meta_title: string | null;
  meta_keywords: string | null;
  og_title: string | null;
  og_description: string | null;
  og_image: string | null;
  canonical_url: string | null;

  // Analytics
  google_analytics_id: string | null;
  google_search_console: string | null;
  facebook_pixel_id: string | null;
  twitter_site: string | null;

  // Audit
  created_at: string;
  updated_at: string;
}

// ── Contact Channel ─────────────────────────────
interface ContactChannel {
  type: string;          // "email" | "phone" | "facebook" | "zalo" | ...
  value: string;         // Gia tri (email, sdt, username...)
  label?: string;        // Ten hien thi
  icon?: string;         // Icon name hoac URL
  url_template?: string; // URL khi click
  enabled: boolean;      // Dang bat hay tat
  sort_order?: number;   // Thu tu sap xep
}

// ── Request body cap nhat (admin) ───────────────
type UpdateGeneralConfigDto = Partial<Omit<GeneralConfig, 'id' | 'created_at' | 'updated_at'>>;
```

---

## 5. Contact Channels

`contact_channels` la mang cac kenh lien he, luu dang JSON trong database. API **luon tra ve array** (khong bao gio null).

### Vi du su dung

```json
[
  {
    "type": "email",
    "value": "support@truyenhay.com",
    "label": "Email ho tro",
    "icon": "mail",
    "url_template": "mailto:support@truyenhay.com",
    "enabled": true,
    "sort_order": 1
  },
  {
    "type": "phone",
    "value": "0901234567",
    "label": "Hotline",
    "icon": "phone",
    "url_template": "tel:0901234567",
    "enabled": true,
    "sort_order": 2
  },
  {
    "type": "facebook",
    "value": "truyenhay",
    "label": "Facebook",
    "icon": "facebook",
    "url_template": "https://fb.com/truyenhay",
    "enabled": true,
    "sort_order": 3
  },
  {
    "type": "zalo",
    "value": "0901234567",
    "label": "Zalo",
    "icon": "zalo",
    "url_template": "https://zalo.me/0901234567",
    "enabled": false,
    "sort_order": 4
  }
]
```

### Render trong FE

```tsx
function ContactList({ channels }: { channels: ContactChannel[] }) {
  const activeChannels = channels
    .filter(ch => ch.enabled)
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

  return (
    <div>
      {activeChannels.map(ch => (
        <a key={ch.type} href={ch.url_template}>
          <Icon name={ch.icon} />
          <span>{ch.label || ch.value}</span>
        </a>
      ))}
    </div>
  );
}
```

---

## 6. Caching va hieu nang

### Server-side cache

- **Cache key:** `config:public:general`
- **TTL:** 600 giay (10 phut)
- **Tu dong xoa cache** khi admin cap nhat config
- **Chong cache stampede:** neu nhieu request den cung luc khi cache trong, chi 1 request goi DB, cac request khac cho ket qua tu request dau

### Khuyen nghi cho FE

General config it thay doi → nen cache o phia client:

```typescript
// Cache trong memory, goi lai khi can refresh
let configCache: GeneralConfig | null = null;
let configFetchedAt = 0;
const CONFIG_TTL = 5 * 60 * 1000; // 5 phut

async function getGeneralConfig(): Promise<GeneralConfig> {
  const now = Date.now();
  if (configCache && now - configFetchedAt < CONFIG_TTL) {
    return configCache;
  }

  const { data } = await api.get('/config/general');
  configCache = data.data;
  configFetchedAt = now;
  return configCache!;
}
```

Hoac voi **Next.js App Router**:

```typescript
// Server Component - tu dong cache boi Next.js
async function getConfig() {
  const res = await fetch(`${process.env.API_URL}/api/config/general`, {
    next: { revalidate: 600 }, // Revalidate moi 10 phut (khop voi server cache)
  });
  return res.json();
}
```

---

## 7. Code mau tich hop

### 7.1. Khoi tao app voi config

```tsx
// providers/config-provider.tsx
'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

interface GeneralConfig {
  site_name: string;
  site_description: string | null;
  site_logo: string | null;
  site_favicon: string | null;
  site_email: string | null;
  site_phone: string | null;
  site_copyright: string | null;
  timezone: string;
  locale: string;
  currency: string;
  contact_channels: ContactChannel[];
  meta_title: string | null;
  meta_keywords: string | null;
  og_title: string | null;
  og_description: string | null;
  og_image: string | null;
  canonical_url: string | null;
  google_analytics_id: string | null;
  facebook_pixel_id: string | null;
}

interface ContactChannel {
  type: string;
  value: string;
  label?: string;
  icon?: string;
  url_template?: string;
  enabled: boolean;
  sort_order?: number;
}

const ConfigContext = createContext<GeneralConfig | null>(null);

export function useConfig() {
  const config = useContext(ConfigContext);
  if (!config) throw new Error('useConfig phai dung trong ConfigProvider');
  return config;
}

export function ConfigProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<GeneralConfig | null>(null);

  useEffect(() => {
    fetch('/api/config/general')
      .then(res => res.json())
      .then(res => setConfig(res.data))
      .catch(console.error);
  }, []);

  if (!config) return <div>Dang tai...</div>;

  return (
    <ConfigContext.Provider value={config}>
      {children}
    </ConfigContext.Provider>
  );
}
```

### 7.2. Su dung config trong component

```tsx
// components/header.tsx
function Header() {
  const config = useConfig();

  return (
    <header>
      {config.site_logo && <img src={config.site_logo} alt={config.site_name} />}
      <h1>{config.site_name}</h1>
    </header>
  );
}

// components/footer.tsx
function Footer() {
  const config = useConfig();

  const activeChannels = config.contact_channels
    .filter(ch => ch.enabled)
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

  return (
    <footer>
      <p>{config.site_copyright}</p>

      {config.site_email && <a href={`mailto:${config.site_email}`}>{config.site_email}</a>}
      {config.site_phone && <a href={`tel:${config.site_phone}`}>{config.site_phone}</a>}

      <div className="social-links">
        {activeChannels.map(ch => (
          <a key={ch.type} href={ch.url_template} target="_blank" rel="noopener">
            {ch.label || ch.type}
          </a>
        ))}
      </div>
    </footer>
  );
}
```

### 7.3. SEO metadata (Next.js)

```tsx
// app/layout.tsx
import { Metadata } from 'next';

async function getConfig() {
  const res = await fetch(`${process.env.API_URL}/api/config/general`, {
    next: { revalidate: 600 },
  });
  const json = await res.json();
  return json.data;
}

export async function generateMetadata(): Promise<Metadata> {
  const config = await getConfig();

  return {
    title: {
      default: config.meta_title || config.site_name,
      template: `%s | ${config.site_name}`,
    },
    description: config.og_description || config.site_description,
    keywords: config.meta_keywords,
    openGraph: {
      title: config.og_title || config.site_name,
      description: config.og_description || config.site_description,
      images: config.og_image ? [config.og_image] : [],
      url: config.canonical_url,
      siteName: config.site_name,
    },
    twitter: {
      card: 'summary_large_image',
      site: config.twitter_site,
    },
    icons: {
      icon: config.site_favicon,
    },
    alternates: {
      canonical: config.canonical_url,
    },
  };
}
```

### 7.4. Analytics scripts

```tsx
// components/analytics.tsx
'use client';

import Script from 'next/script';
import { useConfig } from '@/providers/config-provider';

export function Analytics() {
  const config = useConfig();

  return (
    <>
      {/* Google Analytics */}
      {config.google_analytics_id && (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${config.google_analytics_id}`}
            strategy="afterInteractive"
          />
          <Script id="ga-init" strategy="afterInteractive">
            {`
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', '${config.google_analytics_id}');
            `}
          </Script>
        </>
      )}

      {/* Facebook Pixel */}
      {config.facebook_pixel_id && (
        <Script id="fb-pixel" strategy="afterInteractive">
          {`
            !function(f,b,e,v,n,t,s)
            {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
            n.callMethod.apply(n,arguments):n.queue.push(arguments)};
            if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
            n.queue=[];t=b.createElement(e);t.async=!0;
            t.src=v;s=b.getElementsByTagName(e)[0];
            s.parentNode.insertBefore(t,s)}(window, document,'script',
            'https://connect.facebook.net/en_US/fbevents.js');
            fbq('init', '${config.facebook_pixel_id}');
            fbq('track', 'PageView');
          `}
        </Script>
      )}
    </>
  );
}
```

### 7.5. Admin form cap nhat config

```tsx
// admin/settings/general.tsx
'use client';

import { useState, useEffect } from 'react';
import api from '@/lib/api';

export default function GeneralConfigForm() {
  const [form, setForm] = useState({
    site_name: '',
    site_description: '',
    site_logo: '',
    site_favicon: '',
    site_email: '',
    site_phone: '',
    site_address: '',
    site_copyright: '',
    timezone: 'Asia/Ho_Chi_Minh',
    locale: 'vi',
    currency: 'VND',
    meta_title: '',
    meta_keywords: '',
    og_title: '',
    og_description: '',
    og_image: '',
    canonical_url: '',
    google_analytics_id: '',
    facebook_pixel_id: '',
    twitter_site: '',
  });

  // Load config hien tai
  useEffect(() => {
    api.get('/config/general').then(({ data }) => {
      const config = data.data;
      setForm(prev => ({
        ...prev,
        ...Object.fromEntries(
          Object.entries(config).filter(([_, v]) => v !== null)
        ),
      }));
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.put('/config/general', form);
      alert('Cap nhat thanh cong!');
    } catch (err: any) {
      if (err.response?.status === 400) {
        alert('Du lieu khong hop le: ' + err.response.data.message);
      } else if (err.response?.status === 403) {
        alert('Ban khong co quyen chinh sua cau hinh');
      }
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <label>Ten website</label>
      <input
        value={form.site_name}
        onChange={e => setForm({ ...form, site_name: e.target.value })}
        maxLength={255}
      />

      <label>Logo URL</label>
      <input
        value={form.site_logo}
        onChange={e => setForm({ ...form, site_logo: e.target.value })}
        placeholder="https://..."
      />

      {/* ... tuong tu cho cac field khac ... */}

      <button type="submit">Luu cau hinh</button>
    </form>
  );
}
```

---

## 8. Xu ly loi

### Format loi chuan

```json
{
  "success": false,
  "statusCode": 400,
  "message": "Bad Request",
  "error": [
    "site_logo must be a URL address",
    "site_email must be an email"
  ],
  "timestamp": "2026-05-09T10:00:00.000Z"
}
```

### Bang loi thuong gap

| Status | Endpoint     | Y nghia                                 | FE xu ly                         |
|--------|-------------|------------------------------------------|----------------------------------|
| 400    | PUT         | Validation loi (URL, email, do dai...)   | Hien thi loi tung field          |
| 401    | PUT         | Token het han hoac khong hop le          | Refresh token, neu fail → logout |
| 403    | PUT         | Khong co quyen `config.manage`           | Hien "Khong co quyen"            |
| 500    | PUT         | Loi server khi luu                       | Hien "Co loi xay ra"             |

> **Luu y:** Endpoint GET public **khong co loi thuong gap** — neu chua co config nao trong DB, server tra ve `null` hoac object rong. FE nen xu ly truong hop nay bang gia tri mac dinh.
