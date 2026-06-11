# 02 — Development Roadmap

แผนพัฒนาแบ่งเป็นเฟส แต่ละเฟสส่งมอบได้จริง (ทดสอบ + deploy ได้)

## สรุปเฟส
| Phase | ชื่อ | เป้าหมายหลัก | สถานะ |
| --- | --- | --- | --- |
| 0 | Foundation / Scaffold | โครงสร้าง monorepo, เอกสาร, env, .gitignore | ✅ เสร็จ |
| 1 | Core Backend | NestJS base, MySQL, Auth (JWT), Users, Tenants, RBAC | ✅ เสร็จ |
| 2 | Core Frontend | Next.js base, i18n th/en, Shadcn theme (Kanit/#E60012), Auth UI, Dashboard shell | ✅ เสร็จ |
| 3 | AI Engine | OpenAI integration, Content Generator, prompt templates, usage/quota | ✅ เสร็จ |
| 4 | Marketing Modules | Products, Campaigns, Promotions, scheduling | ⏳ |
| 5 | Realtime & Notifications | Socket.io gateway, live notifications, AI chat | ⏳ |
| 6 | Analytics | Dashboards, sales metrics, reports, export | ⏳ |
| 7 | Billing & Plans | Plans, subscriptions, usage limits, invoices | ⏳ |
| 8 | Hardening & Deploy | Security, tests, Nginx/PM2 บน AlmaLinux, monitoring, backups | ⏳ |

---

## รายละเอียดแต่ละเฟส

### Phase 0 — Foundation (ปัจจุบัน)
- [x] Monorepo + โครงสร้างโฟลเดอร์
- [x] README, .gitignore, .env.example
- [x] เอกสารสถาปัตยกรรม / roadmap / DB / modules
- [x] Schema ฐานข้อมูล (reference DDL)
- [x] ไฟล์ deploy (Nginx, PM2, scripts)

### Phase 1 — Core Backend ✅
- [x] NestJS project (config + Joi env validation + logging)
- [x] เชื่อม MySQL ผ่าน TypeORM (entities: tenants/users/roles/refresh_tokens/password_resets)
- [x] โมดูล `auth` (register/login/refresh/logout/me) ด้วย JWT + refresh token rotation
- [x] โมดูล `users` (CRUD) + `tenants` (get/update) + RBAC guards
- [x] i18n backend (th/en error messages) + response envelope มาตรฐาน
- [x] Global JwtAuthGuard + RolesGuard + ValidationPipe + ExceptionFilter + TransformInterceptor

### Phase 2 — Core Frontend ✅
- [x] Next.js (App Router) + Tailwind + Shadcn UI (button/input/label/card)
- [x] ธีม: Kanit, primary `#E60012`, accent gold, mobile first
- [x] i18n locale routing `/[locale]/` (default th) ด้วย next-intl + locale switcher
- [x] หน้า Auth (login/register) เชื่อม backend จริง + จัดการ token/refresh
- [x] AppShell: Sidebar + Topbar + Dashboard (การ์ดสถิติ) + protected route
- [x] หน้า placeholder สำหรับ content/campaigns/products/analytics/chat/settings

### Phase 3 — AI Engine ✅
- [x] โมดูล `ai` ห่อ OpenAI API (`openai` SDK) + config (model/maxTokens/temperature)
- [x] Content generator (caption/post/ad/line_broadcast) + prompt template (th/en) + tone
- [x] บันทึก `ai_requests`, สรุป `ai_usage` รายเดือน, บังคับ quota (token limit)
- [x] โมดูล `content` (บันทึก/ดู/ลบ content_items เป็นแบบร่าง)
- [x] Content Studio UI: ฟอร์มสร้าง + แก้ไข + คัดลอก + บันทึก + แสดงโควต้า

### Phase 4 — Marketing Modules ✅
- [x] โมดูล `products` (CRUD สินค้า + จัดการ `categories`) แบบ tenant-scoped
- [x] โมดูล `campaigns` (CRUD แคมเปญ + สถานะ draft/scheduled/running/completed/archived + วันเริ่ม/สิ้นสุด)
- [x] โมดูล `promotions` (CRUD โปรโมชั่นภายใต้แคมเปญ: percent/amount/bundle)
- [x] Products UI: ตาราง + ฟอร์มเพิ่ม/แก้ไข/ลบ + แผงจัดการหมวดหมู่
- [x] Campaigns UI: ตาราง + ฟอร์มเพิ่ม/แก้ไข/ลบ + แผงจัดการโปรโมชั่นต่อแคมเปญ

### Phase 5 — Realtime & Notifications
- Socket.io gateway (auth ด้วย JWT)
- Notifications แบบ push live
- AI chat (threads + messages, streaming)

### Phase 6 — Analytics
- บันทึก sales_records + สรุป metrics_daily
- Dashboard กราฟ (ยอดขาย, แคมเปญ, AI usage)
- Export รายงาน

### Phase 7 — Billing & Plans
- Plans (free/pro/business)
- Subscriptions + บังคับ limit (users, AI tokens)
- Invoices

### Phase 8 — Hardening & Deploy
- Security review, rate limiting, audit logs
- Unit/e2e tests
- Provision AlmaLinux + Nginx + PM2
- Monitoring + automated backups + CI/CD (GitHub Actions)
