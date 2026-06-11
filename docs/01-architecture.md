# 01 — สถาปัตยกรรมระบบ (Architecture)

## ภาพรวม
**100 Baht Shop Thailand Marketing AI Platform** — เครื่องมือการตลาดภายในองค์กรเดียว (single-tenant)
ออกแบบเป็น **monorepo** แยก frontend / backend และใช้ MySQL เป็นฐานข้อมูลกลาง
ดึงข้อมูลยอดขายจริงจาก ChangSiam ERP API เพื่อแสดงบน Executive Dashboard

## แผนภาพระดับสูง (High-level)
```mermaid
flowchart LR
    U[ผู้ใช้ / เบราว์เซอร์<br/>Mobile First] -->|HTTPS| NGINX[Nginx<br/>reverse proxy + SSL]

    NGINX -->|/| FE[Next.js<br/>Tailwind + Shadcn<br/>i18n th/en]
    NGINX -->|/api| BE[NestJS API]
    NGINX -->|/socket.io| WS[NestJS<br/>Socket.io Gateway]

    FE -->|REST| BE
    FE -->|WebSocket| WS

    BE --> DB[(MySQL)]
    WS --> DB
    BE -->|JWT| AUTH[Auth Guard]
    BE -->|API| OPENAI[OpenAI API]
```

## หลักการออกแบบ
- **Mobile First** — UI ออกแบบจากจอเล็กก่อน
- **Thai-first i18n** — ข้อความทั้งหมดผ่าน dictionary (`th` default, `en` future)
- **Single-tenant** — ระบบสำหรับองค์กรเดียว (`tenant_id = 1` เสมอ), ไม่มี billing/plans
- **Stateless Auth** — JWT access (อายุสั้น) + refresh token (เก็บ hash ใน DB)
- **Realtime** — Socket.io สำหรับ notifications และ AI chat
- **AI as a service** — โมดูล `ai` ห่อ OpenAI API พร้อม template, usage tracking, quota
- **ERP Integration** — ดึงข้อมูลยอดขายจริงจาก ChangSiam ERP API สำหรับ dashboard ผู้บริหาร

## ชั้นของระบบ (Layers)
| ชั้น | เทคโนโลยี | หน้าที่ |
| --- | --- | --- |
| Presentation | Next.js + Tailwind + Shadcn | UI/UX, routing ตาม locale |
| API | NestJS (REST) | business logic, validation |
| Realtime | Socket.io Gateway | event-driven updates |
| Data | MySQL | persistence (multi-tenant) |
| External | OpenAI API | content generation |
| Infra | AlmaLinux + Nginx + PM2 | hosting, proxy, process mgmt |

## ความปลอดภัย (สรุป)
- JWT + refresh token rotation
- RBAC (super_admin / admin / marketing_manager / marketing_staff / branch_manager / customer_service)
- Rate limiting (per IP)
- Validation ทุก input (DTO)
- Secrets ผ่าน `.env` (ไม่ commit)
