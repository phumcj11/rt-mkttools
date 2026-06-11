# ร้าน 100 บาท — Marketing AI Platform

> แพลตฟอร์ม AI การตลาดสำหรับร้าน 100 บาท (100 Baht Shop Thailand)
> Modern SaaS Dashboard · Mobile First · Thai-first (i18n ready for English)

[![Status](https://img.shields.io/badge/status-scaffold-blue)]()
[![License](https://img.shields.io/badge/license-Proprietary-red)]()

แพลตฟอร์มช่วยให้ร้านค้าสร้างคอนเทนต์การตลาด วางแผนแคมเปญ และวิเคราะห์ยอดขายด้วย AI
โดยใช้ OpenAI สร้างแคปชั่น โพสต์โซเชียล โปรโมชั่น และข้อความหาลูกค้าแบบอัตโนมัติ

---

## 📑 สารบัญ (Table of Contents)

1. [ภาพรวมระบบ (Overview)](#-ภาพรวมระบบ-overview)
2. [Tech Stack](#-tech-stack)
3. [โครงสร้างโฟลเดอร์ (Folder Structure)](#-โครงสร้างโฟลเดอร์-folder-structure)
4. [Development Roadmap](#-development-roadmap)
5. [Database Overview](#-database-overview)
6. [Module Overview](#-module-overview)
7. [การติดตั้ง (Getting Started)](#-การติดตั้ง-getting-started)
8. [i18n / Localization](#-i18n--localization)
9. [Deployment](#-deployment)

---

## 🎯 ภาพรวมระบบ (Overview)

| รายการ | รายละเอียด |
| --- | --- |
| ชื่อโปรเจกต์ | ร้าน 100 บาท Marketing AI Platform |
| รูปแบบ | Multi-tenant SaaS (รองรับหลายร้าน) |
| ภาษาเริ่มต้น | ไทย (`th`) — รองรับอังกฤษ (`en`) ในอนาคต |
| ดีไซน์ | Modern SaaS Dashboard, Mobile First |
| ฟอนต์ | Kanit |
| สีหลัก | `#E60012` (แดง) · สีรอง: ขาว · สีเน้น: ทอง (Gold) |

**ความสามารถหลัก**
- 🤖 สร้างคอนเทนต์การตลาดด้วย AI (แคปชั่น, โพสต์, โปรโมชั่น)
- 📅 วางแผนและจัดตารางแคมเปญ
- 📊 แดชบอร์ดวิเคราะห์ยอดขาย/ลูกค้า
- 💬 แชต AI ผู้ช่วยการตลาดแบบเรียลไทม์
- 🔔 การแจ้งเตือนแบบเรียลไทม์ (Socket.io)
- 👥 ระบบผู้ใช้และสิทธิ์ (RBAC)

---

## 🧱 Tech Stack

| ชั้น (Layer) | เทคโนโลยี |
| --- | --- |
| Frontend | Next.js, Tailwind CSS, Shadcn UI |
| Backend | NestJS |
| Database | MySQL |
| Realtime | Socket.io |
| Auth | JWT |
| AI | OpenAI API |
| Deployment | AlmaLinux VPS, Nginx, PM2 |
| Source Control | GitHub |

---

## 📂 โครงสร้างโฟลเดอร์ (Folder Structure)

```
rt_mkttools/                      # Monorepo root
├── frontend/                     # Next.js + Tailwind + Shadcn UI (Thai-first)
│   ├── public/
│   ├── src/
│   │   ├── app/                  # App Router (locale-based routing)
│   │   │   └── [locale]/         # th (default) | en
│   │   ├── components/
│   │   │   ├── ui/               # Shadcn UI components
│   │   │   ├── layout/           # Sidebar, Topbar, Shell
│   │   │   └── shared/
│   │   ├── features/             # Feature modules (dashboard, content, campaigns...)
│   │   ├── lib/                  # api client, socket, utils
│   │   ├── hooks/
│   │   ├── stores/               # state management
│   │   ├── styles/               # globals.css, theme tokens
│   │   └── i18n/                 # locale config + dictionaries
│   │       └── messages/
│   │           ├── th.json       # ภาษาไทย (default)
│   │           └── en.json       # English (future)
│   └── README.md
│
├── backend/                      # NestJS REST API + WebSocket Gateway
│   ├── src/
│   │   ├── modules/              # auth, users, tenants, ai, content,
│   │   │                         #   campaigns, products, analytics,
│   │   │                         #   notifications, billing
│   │   ├── common/               # guards, interceptors, filters, decorators
│   │   ├── config/               # config schema + loaders
│   │   ├── database/             # ORM entities, data source
│   │   └── i18n/                 # backend message catalogs (th, en)
│   └── README.md
│
├── database/                     # MySQL schema, migrations, seeds, ERD
│   ├── schema/                   # DDL (table definitions)
│   ├── migrations/               # versioned migration files
│   ├── seeds/                    # seed data (master data, demo tenant)
│   ├── erd/                      # ERD diagrams
│   └── README.md
│
├── deploy/                       # AlmaLinux + Nginx + PM2 deployment
│   ├── nginx/                    # server blocks (reverse proxy + SSL)
│   ├── pm2/                      # ecosystem.config.js
│   ├── scripts/                  # provision, deploy, backup scripts
│   ├── systemd/                  # optional unit files
│   └── README.md
│
├── docs/                         # Architecture & product documentation
│   ├── 01-architecture.md
│   ├── 02-roadmap.md
│   ├── 03-database-overview.md
│   ├── 04-module-overview.md
│   ├── 05-i18n.md
│   ├── 06-api-conventions.md
│   ├── 07-deployment.md
│   └── README.md
│
├── .env.example                  # ตัวอย่างตัวแปรสภาพแวดล้อมทั้งระบบ
├── .gitignore
├── package.json                  # workspace root (npm/pnpm workspaces)
└── README.md                     # ไฟล์นี้
```

---

## 🗺️ Development Roadmap

> รายละเอียดเต็มอยู่ที่ [`docs/02-roadmap.md`](docs/02-roadmap.md)

| Phase | ชื่อ | สิ่งที่ส่งมอบ | สถานะ |
| --- | --- | --- | --- |
| **0** | Foundation / Scaffold | Monorepo, โครงสร้างโฟลเดอร์, เอกสาร, env, CI base | ✅ ปัจจุบัน |
| **1** | Core Backend | NestJS base, MySQL, Auth (JWT), Users, Tenants | ⏳ |
| **2** | Core Frontend | Next.js base, i18n (th/en), Shadcn theme, Auth UI, Dashboard shell | ⏳ |
| **3** | AI Engine | OpenAI integration, Content Generator, Prompt templates | ⏳ |
| **4** | Marketing Modules | Campaigns, Products, Promotions, Scheduling | ⏳ |
| **5** | Realtime & Notifications | Socket.io gateway, live notifications, AI chat | ⏳ |
| **6** | Analytics | Dashboards, reports, export | ⏳ |
| **7** | Billing & Plans | Subscription tiers, usage limits | ⏳ |
| **8** | Hardening & Deploy | Security, tests, Nginx/PM2 on AlmaLinux, monitoring | ⏳ |

---

## 🗄️ Database Overview

> รายละเอียดเต็ม + ERD อยู่ที่ [`docs/03-database-overview.md`](docs/03-database-overview.md)
> และ DDL อยู่ที่ [`database/schema/`](database/schema/)

**กลุ่มตารางหลัก (Multi-tenant by `tenant_id`):**

| กลุ่ม | ตารางสำคัญ | หน้าที่ |
| --- | --- | --- |
| Tenancy & Access | `tenants`, `users`, `roles`, `user_roles` | ร้านค้า, ผู้ใช้, สิทธิ์ |
| Auth | `refresh_tokens`, `password_resets` | จัดการ JWT/refresh |
| Catalog | `products`, `categories` | สินค้าและหมวดหมู่ |
| Marketing | `campaigns`, `promotions`, `content_items` | แคมเปญ, โปรโมชั่น, คอนเทนต์ |
| AI | `ai_requests`, `ai_templates`, `ai_usage` | ประวัติเรียก AI, เทมเพลต, โควต้า |
| Realtime | `notifications`, `chat_threads`, `chat_messages` | แจ้งเตือน, แชต |
| Analytics | `sales_records`, `metrics_daily` | ข้อมูลยอดขาย/สถิติ |
| Billing | `plans`, `subscriptions`, `invoices` | แพ็กเกจและการชำระเงิน |
| System | `audit_logs`, `settings` | log และตั้งค่า |

---

## 🧩 Module Overview

> รายละเอียดเต็มอยู่ที่ [`docs/04-module-overview.md`](docs/04-module-overview.md)

**Backend Modules (NestJS):** `auth` · `users` · `tenants` · `products` · `campaigns` · `content` · `ai` · `notifications` · `analytics` · `billing` · `realtime` (gateway)

**Frontend Features (Next.js):** `auth` · `dashboard` · `content-studio` · `campaigns` · `products` · `analytics` · `chat` · `settings`

---

## 🚀 การติดตั้ง (Getting Started)

> ℹ️ ขณะนี้เป็นเฟส Scaffold — ยังไม่มี application code
> ขั้นตอนด้านล่างคือแนวทางสำหรับเฟสถัดไป

```bash
# 1. clone
git clone <github-repo-url> rt_mkttools
cd rt_mkttools

# 2. คัดลอกไฟล์ env
cp .env.example .env

# 3. ติดตั้ง dependencies (เมื่อมี workspace)
npm install

# 4. เตรียม database (MySQL)
#    สร้าง schema จาก database/schema/ และ seed จาก database/seeds/

# 5. รัน dev
npm run dev:backend     # NestJS
npm run dev:frontend    # Next.js
```

---

## 🌐 i18n / Localization

- ภาษาเริ่มต้น: **ไทย (`th`)**
- รองรับ: เตรียม **อังกฤษ (`en`)** ไว้สำหรับอนาคต
- Frontend ใช้ locale-based routing: `/[locale]/...` (default `th`)
- ข้อความทั้งหมดเก็บใน dictionary: `frontend/src/i18n/messages/{th,en}.json`
- Backend ส่งข้อความ error/notification ผ่าน i18n catalog เช่นกัน

รายละเอียด: [`docs/05-i18n.md`](docs/05-i18n.md)

---

## 📦 Deployment

- เซิร์ฟเวอร์: **AlmaLinux VPS**
- Reverse proxy + SSL: **Nginx**
- Process manager: **PM2** (`deploy/pm2/ecosystem.config.js`)

รายละเอียด: [`docs/07-deployment.md`](docs/07-deployment.md) และ [`deploy/README.md`](deploy/README.md)

---

## 📄 License

Proprietary — © ร้าน 100 บาท. All rights reserved.
