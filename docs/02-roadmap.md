# 02 — Development Roadmap

แผนพัฒนาแบ่งเป็นเฟส แต่ละเฟสส่งมอบได้จริง (ทดสอบ + deploy ได้)

## สรุปเฟส
| Phase | ชื่อ | เป้าหมายหลัก | สถานะ |
| --- | --- | --- | --- |
| 0 | Foundation / Scaffold | โครงสร้าง monorepo, เอกสาร, env, .gitignore | ✅ เสร็จ |
| 1 | Core Backend | NestJS base, MySQL, Auth (JWT), Users, Tenants, RBAC | ✅ เสร็จ |
| 2 | Core Frontend | Next.js base, i18n th/en, Shadcn theme (Kanit/#E60012), Auth UI, Dashboard shell | ✅ เสร็จ |
| 3 | AI Engine | OpenAI integration, Content Generator, prompt templates, usage/quota | ✅ เสร็จ |
| 4 | Marketing Modules | Products, Campaigns, Promotions, scheduling | ✅ เสร็จ |
| 5 | Realtime & Notifications | Socket.io gateway, live notifications, AI chat | ✅ เสร็จ |
| 6 | Analytics | Dashboards, sales metrics, reports, export | ✅ เสร็จ |
| 7 | Executive Dashboard + Branch + ERP + Audit | branch CRUD, executive dashboard ERP data, audit logs, ChangSiam integration | ✅ เสร็จ (production MVP) |
| 8 | PDF Realignment: 8 โมดูล + POSM + Content Factory | single-org, 6 roles, sidebar 8 โมดูล, POSM backend, content 15 ชนิด | ✅ เสร็จ |
| 9 | Google Review Center + LINE OA connector | Review API + AI reply, LINE webhook setup, Omnichannel tabs | ✅ เสร็จ |
| 10 | Social Listening + AI Agent Center | mentions/keywords backend, agent dashboard + run/stop, task queue | ✅ เสร็จ |
| 11 | Hardening + Advanced Integrations | tests, monitoring, MySQL backup cron, Google Business API, FB Messenger | ⏳ ถัดไป |

> เฟส 8–10 align กับ product spec ใน `Marketing AI Platform.pdf` (8 โมดูลหลัก: Auth, Executive Dashboard, AI POSM, AI Content Factory, Google Review Center, Omnichannel Chat, Social Listening, AI Agent Center)

---

## รายละเอียดแต่ละเฟส

### Phase 0 — Foundation
- [x] Monorepo + โครงสร้างโฟลเดอร์
- [x] README, .gitignore, .env.example
- [x] เอกสารสถาปัตยกรรม / roadmap / DB / modules
- [x] Schema ฐานข้อมูล (reference DDL)
- [x] ไฟล์ deploy (Nginx, PM2, scripts)

### Phase 1 — Core Backend ✅
- [x] NestJS project (config + Joi env validation + logging)
- [x] เชื่อม MySQL ผ่าน TypeORM (entities: tenants/users/roles/refresh_tokens/password_resets)
- [x] โมดูล `auth` (register/login/refresh/logout/me/forgot-password/reset-password) ด้วย JWT + refresh token rotation
- [x] โมดูล `users` (CRUD) + `tenants` (get/update) + RBAC guards
- [x] i18n backend (th/en error messages) + response envelope มาตรฐาน
- [x] Global JwtAuthGuard + RolesGuard + ValidationPipe + ExceptionFilter + TransformInterceptor

### Phase 2 — Core Frontend ✅
- [x] Next.js (App Router) + Tailwind + Shadcn UI (button/input/label/card)
- [x] ธีม: Kanit, primary `#E60012`, accent gold, mobile first
- [x] i18n locale routing `/[locale]/` (default th) ด้วย next-intl + locale switcher
- [x] หน้า Auth (login/register/forgot-password/reset-password) เชื่อม backend จริง + จัดการ token/refresh
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

### Phase 5 — Realtime & Notifications ✅
- [x] Socket.io gateway + auth ด้วย JWT ตอน handshake
- [x] ห้อง realtime แยกตาม `user:{id}` และ `tenant:{id}` + `RealtimeService` (global)
- [x] โมดูล `notifications` (REST: list / unread-count / mark-read / read-all) + push event `notification:new`
- [x] โมดูล `chat` (threads + messages, tenant/user-scoped) + OpenAI streaming ผ่าน event `chat:send`/`chat:chunk`/`chat:done`
- [x] Frontend: socket client + กระดิ่งแจ้งเตือนบน Topbar + หน้า Chat สตรีมเรียลไทม์

### Phase 6 — Analytics ✅
- [x] `SalesRecord` entity + ตาราง `sales_records` (tenant-scoped)
- [x] โมดูล `analytics` (REST): summary / sales-series / top-products / campaign-status / sales (export)
- [x] Frontend: หน้า Analytics — การ์ดสรุป + กราฟแท่งแนวโน้มยอดขาย + สินค้าขายดี + Export CSV

### Phase 7 — Executive Dashboard + Branch + ERP + Audit ✅
- [x] Branch CRUD (ตาราง `branches` entity, tenant-scoped) + ตัวกรองตามสาขา
- [x] Executive Dashboard เชื่อม ERP จริง (`/erp/dashboard` → `dashboard-view.tsx`)
- [x] `audit_logs` + AuditModule + AuditInterceptor บันทึก mutation สำคัญ
- [x] ChangSiam ERP Integration (โมดูล `erp` — proxy ยอดขายจริง + AI insights)
- [x] Auth เพิ่ม forgot/reset password (token ใน `password_resets`)

### Phase 8 — PDF Realignment + POSM + Content Factory ✅
- [x] ปรับ single-org "100 Baht Shop Thailand" (tenant id=1 fixed) — ถอด multi-tenant/billing ออกจาก runtime
- [x] 6 roles ใหม่: `super_admin`, `admin`, `marketing_manager`, `marketing_staff`, `branch_manager`, `customer_service`
- [x] Sidebar ใหม่ 8 โมดูลตาม PDF + i18n nav
- [x] **POSM Module**: `POST /posm` → AI headline + บันทึก `posm_projects`, `GET /posm`, `DELETE /posm/:id`
- [x] Frontend POSM: เลือก type, กรอกข้อมูล, เรียก API, แสดง AI headline ใน preview, ดาวน์โหลด, ประวัติ
- [x] Content Factory ขยายเป็น 15 ชนิด (fb/tiktok/ig/seo/rewrite/translate/hashtag ฯลฯ)
- [x] DB entities ใหม่: `posm_projects`, `google_reviews`, `social_mentions`, `listening_keywords`, `ai_agents`, `ai_tasks`
- [x] Migration Phase 8 รันแล้วทั้ง production และ local

### Phase 9 — Google Review Center + LINE OA Connector ✅
- [x] **Reviews Module**: `GET /reviews`, `POST /reviews`, `POST /reviews/:id/generate-reply` (AI), `POST /reviews/:id/mark-replied`
- [x] `GET /reviews/stats` — total / avgRating / negative / unreplied
- [x] Frontend Reviews: โหลดจาก API จริง, เพิ่มรีวิว, AI ตอบกลับ, mark replied, refresh
- [x] **LINE OA Webhook**: `POST /api/chat/line-webhook` (Public endpoint, รับ events LINE, log)
- [x] `GET /api/chat/line-config` — แสดงสถานะและ webhook URL
- [x] Frontend Channels tab: แสดง webhook URL, คำแนะนำตั้งค่า LINE, toggle setup guide
- [x] Omnichannel Chat: AI Chat ทำงานจริง, Shared Inbox / Customer Profile / Channels tabs scaffold

### Phase 10 — Social Listening + AI Agent Center ✅
- [x] **Social Module**: `GET /social/mentions`, `POST /social/mentions`, `GET /social/stats`
- [x] `GET /social/keywords`, `POST /social/keywords`, `DELETE /social/keywords/:id`
- [x] Frontend Social: โหลด mentions จาก API, เพิ่ม/ลบ keyword จริง, stats จาก DB
- [x] **Agents Module**: `GET /agents`, `POST /agents/:id/run`, `POST /agents/:id/stop`, `GET /agents/stats`
- [x] `GET /agents/tasks` — task queue log
- [x] Auto-seed 8 default agents ถ้า tenant ยังไม่มี agents ใน DB
- [x] Frontend Agents: โหลดจาก API, กด Run/Stop เรียก backend จริง, stats จาก DB
- [x] **Cleanup**: ลบ BillingModule dead code + `plan-feature.guard.ts` + `requires-feature.decorator.ts` + billing i18n keys

---

### Phase 11 — Hardening + Advanced Integrations (ถัดไป)
- [ ] Unit/e2e tests (Jest/Supertest backend, Playwright frontend)
- [ ] Rate limiting + security headers (Helmet)
- [ ] Monitoring: PM2 log rotation, application error alerting
- [ ] MySQL automated backup cron (mysqldump → cloud storage)
- [ ] Google Business Profile API — ดึงรีวิวจริงอัตโนมัติ
- [ ] Facebook Messenger connector
- [ ] Instagram DM connector
- [ ] LINE message reply (ส่งข้อความกลับผ่าน LINE Messaging API)
- [ ] Social Listening: crawler/scraper สำหรับ Facebook/TikTok/Pantip keywords
- [ ] AI Agents: task queue ด้วย Bull/BullMQ + cron scheduler

---

## รูปแบบการทำงานในแต่ละเฟส
1. database schema + entities
2. backend API
3. admin/dashboard UI
4. AI layer / automation
5. integration ภายนอก
6. test + deploy + docs

## Milestone ใช้งานจริง
- Phase 7: ผู้บริหารใช้ dashboard + หลายสาขา + ERP จริง ← **ใช้งาน production แล้ว**
- Phase 8–10: ทีม marketing ใช้ POSM / reviews / social / agents ← **backend API พร้อมแล้ว, รอ migration บน production**
- Phase 11: production hardening + connectors จริง ← ถัดไป
