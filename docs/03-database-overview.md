# 03 — Database Overview

MySQL 8.x · InnoDB · `utf8mb4_unicode_ci` (รองรับภาษาไทย + emoji) · **Single-tenant** (tenant_id = 1 เสมอ)
ชื่อ DB: `rt_mkttools` (production และ local dev)

> DDL: [`../database/schema/schema.sql`](../database/schema/schema.sql) · ERD: [`../database/erd/erd.md`](../database/erd/erd.md)

## กลุ่มตาราง (Table Groups)

### 1) Tenancy & Access
| ตาราง | หน้าที่ | ความสัมพันธ์สำคัญ |
| --- | --- | --- |
| `tenants` | องค์กร (row เดียว id=1 "100 Baht Shop Thailand") | root ของทุกข้อมูล |
| `users` | ผู้ใช้ในองค์กร | `tenant_id → tenants` |
| `roles` | บทบาท (super_admin / admin / marketing_manager / marketing_staff / branch_manager / customer_service) | master |
| `user_roles` | จับคู่ผู้ใช้-บทบาท | M:N users↔roles |

### 2) Auth
| ตาราง | หน้าที่ |
| --- | --- |
| `refresh_tokens` | เก็บ hash ของ refresh token + วันหมดอายุ/เพิกถอน |
| `password_resets` | โทเคนรีเซ็ตรหัสผ่าน |

### 3) Catalog
| ตาราง | หน้าที่ |
| --- | --- |
| `categories` | หมวดหมู่สินค้า |
| `products` | สินค้า (ชื่อ, ราคา, รูป, สถานะ) |

### 4) Marketing
| ตาราง | หน้าที่ |
| --- | --- |
| `campaigns` | แคมเปญการตลาด (objective, channel, ช่วงเวลา) |
| `promotions` | โปรโมชั่น/ส่วนลด ผูกกับแคมเปญ |
| `content_items` | คอนเทนต์ (caption/post/ad/line/blog) + สถานะ + ตารางเผยแพร่ |

### 5) AI
| ตาราง | หน้าที่ |
| --- | --- |
| `ai_templates` | เทมเพลต prompt (ระบบกลาง หรือเฉพาะร้าน) |
| `ai_requests` | ประวัติเรียก OpenAI (prompt/response/tokens/status) |
| `ai_usage` | สรุปการใช้งานต่อเดือน (ใช้บังคับ quota) |

### 6) Realtime
| ตาราง | หน้าที่ |
| --- | --- |
| `notifications` | การแจ้งเตือน (อ่าน/ยังไม่อ่าน) |
| `chat_threads` | ห้องแชต AI ของผู้ใช้ |
| `chat_messages` | ข้อความในห้องแชต (user/assistant/system) |

### 7) Analytics
| ตาราง | หน้าที่ |
| --- | --- |
| `sales_records` | บันทึกยอดขายรายรายการ |
| `metrics_daily` | สรุปรายวัน (ยอดขาย/ออเดอร์/AI requests) |

### 8) Phase 8 — โมดูลใหม่
| ตาราง | หน้าที่ |
| --- | --- |
| `posm_projects` | งาน AI POSM Generator (ประเภท/สถานะ/export) |
| `google_reviews` | รีวิว Google รายสาขา (rating/sentiment/status) |
| `social_mentions` | Social Listening: mentions จากทุกช่องทาง |
| `listening_keywords` | คีย์เวิร์ดสำหรับ monitor (brand/product/competitor) |
| `ai_agents` | AI Agent definitions (type/prompt/config) |
| `ai_tasks` | คิว/ผล task ที่รัน agent |

### 9) System
| ตาราง | หน้าที่ |
| --- | --- |
| `settings` | ค่าตั้งระบบ/ร้าน (key-value) |
| `audit_logs` | บันทึกการกระทำสำคัญ (JSON metadata) |

## หลักการออกแบบ
- **Single-tenant**: ทุก query ผ่าน `tenant_id = 1` เสมอ ไม่มี plan/billing enforcement
- **Soft constraints**: ใช้ ENUM สำหรับสถานะเพื่อความชัดเจน
- **Index**: ใส่ index บน `tenant_id` และคอลัมน์ที่ค้นหาบ่อย (เช่น `sold_at`, `branch_id`)
- **Charset**: `utf8mb4` รองรับภาษาไทยและอีโมจิเต็มรูปแบบ
- **เวลา**: เก็บเป็น `DATETIME` (TZ `Asia/Bangkok` ที่ชั้น app)
- **Migrations**: เก็บใน `database/migrations/` — รันผ่าน `deploy/scripts/run-prod-migration.py`
