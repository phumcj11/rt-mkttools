# Database — MySQL

สคีมาและข้อมูลตั้งต้นของแพลตฟอร์ม AI การตลาดร้าน 100 บาท

## Engine & Charset
- MySQL 8.x · InnoDB
- Charset: `utf8mb4` / Collation: `utf8mb4_unicode_ci` (รองรับภาษาไทยและอีโมจิ)

## โครงสร้าง
```
database/
├── schema/
│   └── schema.sql       # DDL ทุกตาราง (reference design)
├── migrations/          # ไฟล์ migration แบบ versioned (ใช้ ORM ในเฟส 1)
├── seeds/
│   └── seed.sql         # master data (roles, plans) + demo tenant
└── erd/
    └── erd.md           # ERD (Mermaid)
```

## การใช้งาน (เฟสถัดไป)
```bash
# สร้างฐานข้อมูล
mysql -u root -p -e "CREATE DATABASE rt_mkttools CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

# โหลด schema
mysql -u root -p rt_mkttools < database/schema/schema.sql

# โหลด seed
mysql -u root -p rt_mkttools < database/seeds/seed.sql
```

## Multi-tenant
ทุกตารางธุรกิจมี `tenant_id` และทำ tenant isolation ที่ชั้น application (NestJS guard/interceptor)

> ภาพรวมรายละเอียด: [`../docs/03-database-overview.md`](../docs/03-database-overview.md)
