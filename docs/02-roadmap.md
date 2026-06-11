# 02 — Development Roadmap

แผนพัฒนาแบ่งเป็นเฟส แต่ละเฟสส่งมอบได้จริง (ทดสอบ + deploy ได้)

## สรุปเฟส
| Phase | ชื่อ | เป้าหมายหลัก | สถานะ |
| --- | --- | --- | --- |
| 0 | Foundation / Scaffold | โครงสร้าง monorepo, เอกสาร, env, .gitignore | ✅ เสร็จ |
| 1 | Core Backend | NestJS base, MySQL, Auth (JWT), Users, Tenants, RBAC | ✅ เสร็จ |
| 2 | Core Frontend | Next.js base, i18n th/en, Shadcn theme (Kanit/#E60012), Auth UI, Dashboard shell | ⏳ |
| 3 | AI Engine | OpenAI integration, Content Generator, prompt templates, usage/quota | ⏳ |
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

### Phase 2 — Core Frontend
- Next.js (App Router) + Tailwind + Shadcn UI
- ธีม: Kanit, primary `#E60012`, accent gold, mobile first
- i18n locale routing `/[locale]/` (default th)
- หน้า Auth (login/register) เชื่อม backend
- AppShell: Sidebar + Topbar + Dashboard ว่าง

### Phase 3 — AI Engine
- โมดูล `ai` ห่อ OpenAI API
- Content generator (caption/post/ad/line broadcast)
- ระบบ prompt template (th/en)
- บันทึก `ai_requests`, สรุป `ai_usage`, บังคับ quota
- Content Studio UI

### Phase 4 — Marketing Modules
- CRUD: products, categories
- CRUD: campaigns, promotions
- จัดตารางเผยแพร่คอนเทนต์ (scheduled_at)

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
