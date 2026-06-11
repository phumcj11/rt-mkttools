# 03 — Database Overview

MySQL 8.x · InnoDB · `utf8mb4_unicode_ci` (รองรับภาษาไทย + emoji)
สถาปัตยกรรม **multi-tenant**: ทุกตารางธุรกิจอ้างอิง `tenant_id`

> DDL: [`../database/schema/schema.sql`](../database/schema/schema.sql) · ERD: [`../database/erd/erd.md`](../database/erd/erd.md)

## กลุ่มตาราง (Table Groups)

### 1) Tenancy & Access
| ตาราง | หน้าที่ | ความสัมพันธ์สำคัญ |
| --- | --- | --- |
| `tenants` | ร้านค้า (หน่วยเช่า) | root ของทุกข้อมูล |
| `users` | ผู้ใช้ในร้าน | `tenant_id → tenants` |
| `roles` | บทบาท (owner/admin/editor/viewer) | master |
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

### 8) Billing
| ตาราง | หน้าที่ |
| --- | --- |
| `plans` | แพ็กเกจ (free/pro/business) + limit |
| `subscriptions` | การสมัครของร้าน + สถานะ |
| `invoices` | ใบแจ้งหนี้ (THB) |

### 9) System
| ตาราง | หน้าที่ |
| --- | --- |
| `settings` | ค่าตั้งระบบ/ร้าน (key-value) |
| `audit_logs` | บันทึกการกระทำสำคัญ (JSON metadata) |

## หลักการออกแบบ
- **Tenant isolation**: ทุก query ฝั่ง backend กรองด้วย `tenant_id` ผ่าน guard/interceptor
- **Soft constraints**: ใช้ ENUM สำหรับสถานะเพื่อความชัดเจน
- **Index**: ใส่ index บน `tenant_id` และคอลัมน์ที่ค้นหาบ่อย (เช่น `sold_at`)
- **Charset**: `utf8mb4` รองรับภาษาไทยและอีโมจิเต็มรูปแบบ
- **เวลา**: เก็บเป็น `DATETIME` (TZ `Asia/Bangkok` ที่ชั้น app)
