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
| 7 | Billing + Executive Dashboard + Branch | Billing จริง, branch model, executive dashboard v2, audit logs | ⏳ กำลังทำ |
| 8 | AI POSM Generator + Content Factory Expansion | POSM studio (export PNG/JPG/PDF), content types/languages เพิ่ม | ⏳ |
| 9 | Google Review Center + Omnichannel Chat | review ingestion/analysis + reward, shared inbox + channel connectors | ⏳ |
| 10 | Social Listening + AI Agent Center + Hardening | mentions/competitors, agent center, tests/monitoring/backup | ⏳ |

> เฟส 7-10 จัดใหม่ให้ align กับ product spec ใน `Marketing AI Platform.pdf` (8 โมดูลหลัก: Auth, Executive Dashboard, AI POSM, AI Content Factory, Google Review Center, Omnichannel Chat, Social Listening, AI Agent Center)

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

### Phase 5 — Realtime & Notifications ✅
- [x] Socket.io gateway (`@nestjs/platform-socket.io`) + auth ด้วย JWT ตอน handshake (`auth.token`)
- [x] ห้อง realtime แยกตาม `user:{id}` และ `tenant:{id}` + `RealtimeService` (global) สำหรับ emit
- [x] โมดูล `notifications` (REST: list / unread-count / mark-read / read-all) + push event `notification:new`
- [x] ผูก notification เข้ากับ flow จริง (สร้างแคมเปญ / บันทึกคอนเทนต์)
- [x] โมดูล `chat` (threads + messages, tenant/user-scoped) + OpenAI streaming ผ่าน event `chat:send`/`chat:chunk`/`chat:done`
- [x] Frontend: socket client + กระดิ่งแจ้งเตือนบน Topbar (badge + dropdown) + หน้า Chat สตรีมเรียลไทม์

### Phase 6 — Analytics ✅
- [x] `SalesRecord` entity + ตาราง `sales_records` (tenant-scoped) เป็นแหล่งข้อมูลยอดขาย
- [x] โมดูล `analytics` (REST): summary / sales-series / top-products / campaign-status / sales (export) + บันทึกยอดขาย + สร้างข้อมูลตัวอย่าง
- [x] สรุปเมตริกแบบ on-demand จาก `sales_records` (รวมยอด/ออเดอร์/เฉลี่ย) + โทเค็น AI เดือนนี้จาก `ai_usage`
- [x] Frontend: หน้า Analytics — การ์ดสรุป + กราฟแท่งแนวโน้มยอดขาย + สินค้าขายดี + สถานะแคมเปญ + เลือกช่วง 7/30/90 วัน
- [x] Export รายงานยอดขายเป็น CSV (รองรับภาษาไทยด้วย BOM)
- [x] Dashboard เชื่อมตัวเลขจริง (ยอดขาย, แคมเปญที่ใช้งาน, สินค้า, โทเค็น AI)

### Phase 7 — Billing + Executive Dashboard + Branch ⏳
ปิดงาน billing ให้พร้อม production และวางรากฐานหลายสาขา + dashboard เชิงผู้บริหารตาม PDF

Billing (ต่อจากที่ทำไว้):
- [x] Entities: `plans`, `subscriptions`, `invoices` + BillingModule (REST API)
- [x] สมัครสมาชิก → สร้าง subscription แพ็ก `free` อัตโนมัติ
- [x] บังคับ AI quota / user limit ตามแพ็กเกจ
- [x] Frontend: หน้า Settings/Billing (เปรียบเทียบแพ็ก, upgrade mock, invoices)
- [ ] Invoice lifecycle (open/paid/void) + payment status model
- [ ] Plan enforcement ระดับ feature (ไม่ใช่แค่ token/user)

Branch Foundation:
- [ ] ตาราง `branches` + entity (tenant-scoped)
- [ ] ผูก `users` / `sales_records` / `campaigns` กับ `branch_id`
- [ ] ตัวกรองตามสาขาใน API analytics

Executive Dashboard v2 (ตาม PDF MODULE 2):
- [ ] ยอดขายรวม / รายสาขา / รายหมวด / สินค้าขายดี
- [ ] KPI chat (จาก conversations) + placeholder KPI review/social
- [ ] AI Insight layer (เช่น "ยอดขายยาดมลดลง 12% แนะนำให้สร้าง TikTok")

Audit:
- [ ] `audit_logs` จริง + interceptor บันทึก action สำคัญ

### Phase 8 — AI POSM Generator + Content Factory Expansion
โมดูลใหม่ใหญ่จาก PDF (MODULE 3 + MODULE 4)

AI POSM Generator:
- [ ] ตาราง `posm_projects` / `posm_templates` / `posm_assets` / `posm_exports`
- [ ] ชนิดงาน: ป้ายราคา, ป้ายโปรโมชั่น, shelf talker, wobbler, A6/A5/A4, Google Review Poster, LINE Rich Menu
- [ ] Input: รูปสินค้า, SKU, ชื่อสินค้า, ราคา, โปรโมชั่น, QR code
- [ ] UI: live preview, drag & drop, resize layout, template gallery, save template, batch generate
- [ ] Export: PNG / JPG / PDF
- [ ] AI: สร้าง headline, ตรวจคำผิด, แปลภาษา, สร้างหลาย layout

Content Factory Expansion:
- [ ] เพิ่มชนิด: Facebook Post, TikTok Caption, TikTok Script, Instagram Caption, LINE Broadcast, Google Business Profile, SEO Article, Product Description, UGC Script
- [ ] AI: rewrite, translate, hashtag generator, content calendar, video shot generator
- [ ] ขยายภาษา output: `th`/`en` → เปิด `zh`/`my`/`ar` แบบ phased

### Phase 9 — Google Review Center + Omnichannel Chat
รวม feedback + การสนทนาทุกช่องทาง (MODULE 5 + MODULE 6)

Google Review Center:
- [ ] ตาราง `google_reviews` / `review_campaigns` / `review_rewards`
- [ ] รีวิวรายสาขา, คะแนนเฉลี่ย, รีวิวใหม่, รีวิวติดลบ, QR code รีวิว
- [ ] Campaign + reward flow (เช่น ซื้อครบ 1,000 + รีวิว → รับถุงแดง)
- [ ] AI: วิเคราะห์/สรุปรีวิว, แนะนำการตอบกลับ, แจ้งเตือนรีวิวลบ

Omnichannel Chat:
- [ ] ตาราง `conversations` / `messages` / `customers`
- [ ] Shared inbox, customer profile, assign chat, quick reply, internal note, ticket system
- [ ] Channel connectors (ทีละช่อง): LINE OA → Facebook Messenger → Instagram DM → TikTok Inbox → WhatsApp → Website Chat
- [ ] AI: auto reply, translate, detect intent, complaint detection, summary

### Phase 10 — Social Listening + AI Agent Center + Hardening
ยกระดับเป็น marketing intelligence platform (MODULE 7 + MODULE 8 + production hardening)

Social Listening:
- [ ] ตาราง `social_mentions` / `listening_keywords` / `competitor_profiles`
- [ ] Monitor: Facebook, TikTok, Instagram, YouTube, Google Reviews
- [ ] Mention feed, trend analysis, competitor monitoring, daily summary, alert system
- [ ] AI: sentiment, viral detection, complaint detection, content recommendation

AI Agent Center:
- [ ] ตาราง `ai_agents` / `ai_prompts` / `ai_tasks` / `ai_logs`
- [ ] Agents: Marketing, Content, POSM, Review, Social, Competitor, Chat, SEO
- [ ] Agent dashboard, prompt management, knowledge base, task queue, logs, performance monitoring

Hardening & Deploy:
- [ ] Unit/e2e tests, rate limiting, security review
- [ ] Monitoring (`pm2 monit` / logs) + automated MySQL backup (cron)
- [ ] CI/CD ครบ (build + ssh deploy — มี workflow แล้ว)

---

## รูปแบบการทำงานในแต่ละเฟส (ทำให้ปล่อยของได้เรื่อยๆ)
1. database schema + entities
2. backend API
3. admin/dashboard UI
4. AI layer / automation
5. integration ภายนอก
6. test + deploy + docs

## Milestone ใช้งานจริง
- Phase 7: ผู้บริหารใช้ dashboard + หลายสาขา + billing จริง
- Phase 8: ทีม marketing สร้าง POSM และ content ได้จริง
- Phase 9: ทีม CS/marketing รวม review + chat ในระบบเดียว
- Phase 10: ใช้ social intelligence + AI agents ทำงานแทนบางส่วน
