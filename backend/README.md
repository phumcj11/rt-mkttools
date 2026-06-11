# Backend — NestJS API + WebSocket Gateway

ส่วนหลังบ้าน (REST API + Realtime) ของแพลตฟอร์ม AI การตลาดร้าน 100 บาท

## Stack
- **NestJS** (modular architecture)
- **MySQL** (ORM: TypeORM/Prisma — กำหนดในเฟส 1)
- **JWT** (access + refresh tokens)
- **Socket.io** (realtime gateway)
- **OpenAI API** (AI module)
- **i18n** สำหรับ error/notification messages (th default, en future)

## โครงสร้างโมดูล (Modules)
```
src/
├── modules/
│   ├── auth/            # JWT, login, register, refresh, guards
│   ├── users/           # จัดการผู้ใช้ + RBAC
│   ├── tenants/         # ร้านค้า (multi-tenant)
│   ├── products/        # สินค้า + หมวดหมู่
│   ├── campaigns/       # แคมเปญ + โปรโมชั่น
│   ├── content/         # คอนเทนต์การตลาด
│   ├── ai/              # OpenAI integration, prompt templates, usage
│   ├── notifications/   # การแจ้งเตือน
│   ├── analytics/       # สถิติ/รายงาน
│   ├── billing/         # แพ็กเกจ/การชำระเงิน
│   └── realtime/        # Socket.io gateway
├── common/              # guards, interceptors, filters, decorators, dto base
├── config/              # config schema + env validation
├── database/            # entities, data source, migrations
└── i18n/                # message catalogs (th, en)
```

## API Conventions
- Base prefix: `/api`
- Auth: `Authorization: Bearer <access_token>`
- ทุก resource เป็น tenant-scoped ผ่าน `tenant_id`
- รายละเอียด: [`../docs/06-api-conventions.md`](../docs/06-api-conventions.md)

## สถานะ: Phase 1 — Core Backend ✅
ใช้งานได้แล้ว: Config + env validation, MySQL (TypeORM), JWT Auth, Users (CRUD + RBAC), Tenants,
i18n (th/en), global guard/filter/interceptor, response envelope มาตรฐาน

### API ที่มี (prefix `/api`)
| Method | Path | สิทธิ์ | หน้าที่ |
| --- | --- | --- | --- |
| GET | `/health` | public | health check |
| POST | `/auth/register` | public | สมัคร (สร้างร้าน + owner) |
| POST | `/auth/login` | public | เข้าสู่ระบบ |
| POST | `/auth/refresh` | public | ต่ออายุ token (rotate) |
| POST | `/auth/logout` | auth | เพิกถอน refresh token |
| GET | `/auth/me` | auth | ข้อมูลผู้ใช้ปัจจุบัน |
| GET | `/users` | owner/admin | รายชื่อผู้ใช้ในร้าน |
| POST | `/users` | owner/admin | เพิ่มผู้ใช้ |
| GET | `/users/:id` | owner/admin | ดูผู้ใช้ |
| PATCH | `/users/:id` | owner/admin | แก้ไขผู้ใช้/บทบาท |
| DELETE | `/users/:id` | owner | ลบผู้ใช้ |
| GET | `/tenants/me` | auth | ข้อมูลร้านปัจจุบัน |
| PATCH | `/tenants/me` | owner/admin | แก้ไขร้าน |

### เริ่มใช้งาน
```bash
# 1) ตั้งค่า .env ที่ root ของ monorepo (คัดลอกจาก .env.example) — ต้องมี DB_* และ JWT_*
# 2) สร้าง DB + โหลด schema
mysql -u root -p -e "CREATE DATABASE rt_mkttools CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
mysql -u root -p rt_mkttools < ../database/schema/schema.sql

# 3) ติดตั้ง + seed roles + รัน
npm install
npm run seed          # เพิ่ม roles: owner/admin/editor/viewer
npm run start:dev     # http://localhost:4000/api
```

> หมายเหตุ: ถ้ายังไม่ได้ seed ระบบจะสร้าง roles พื้นฐานให้อัตโนมัติตอน register ครั้งแรก
