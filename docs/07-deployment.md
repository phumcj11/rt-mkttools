# 07 — Deployment (AlmaLinux + Nginx + PM2)

## เป้าหมาย
รัน **100 Baht Shop Thailand Marketing AI Platform** ประกอบด้วย Next.js (frontend) และ NestJS (backend + Socket.io) บน VPS AlmaLinux
โดยมี Nginx เป็น reverse proxy + SSL และ PM2 จัดการ process

| รายการ | ค่า |
| --- | --- |
| โดเมน production | `marketing.100bahtshopthailand.com` |
| VPS IP | `119.59.102.235` |
| App dir | `/var/www/rt_mkttools` |
| DB | `marketing_ai_100baht` |

## ความต้องการเซิร์ฟเวอร์
- AlmaLinux 9
- Node.js 20+
- MySQL 8.x
- Nginx
- PM2 (global)
- certbot (Let's Encrypt)

## ขั้นตอน

### 1. Provision (ครั้งแรก)
```bash
bash deploy/scripts/provision.sh
```
ติดตั้ง Node, MySQL, Nginx, PM2, certbot

### 2. เตรียมฐานข้อมูล
```bash
mysql -u root -p -e "CREATE DATABASE marketing_ai_100baht CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
mysql -u root -p marketing_ai_100baht < database/schema/schema.sql
mysql -u root -p marketing_ai_100baht < database/seeds/seed.sql
# Migrations Phase 8
mysql -u root -p marketing_ai_100baht < database/migrations/2026_06_phase8_roles_and_org.sql
mysql -u root -p marketing_ai_100baht < database/migrations/2026_06_phase8_new_modules.sql
```

> ถ้า DB เดิมชื่อ `rt_mkttools` แล้วต้องการเปลี่ยนชื่อ:
> ```sql
> RENAME DATABASE rt_mkttools TO marketing_ai_100baht;
> -- หรือ dump + restore แล้วแก้ DB_DATABASE ใน .env
> ```

### 3. โค้ดและ environment
```bash
cd /var/www && git clone https://github.com/phumcj11/rt-mkttools.git rt_mkttools
cd rt_mkttools && cp .env.example .env
# แก้ค่าสำคัญ: DB_DATABASE=marketing_ai_100baht, JWT secrets, OPENAI_API_KEY, ERP_API_KEY
npm install
```

### 4. Nginx
```bash
cp deploy/nginx/rt_mkttools.conf /etc/nginx/conf.d/
nginx -t && systemctl reload nginx
certbot --nginx -d marketing.100bahtshopthailand.com
```

### 5. Build + Start (PM2)
```bash
npm run build:backend
npm run build:frontend
pm2 start deploy/pm2/ecosystem.config.js --env production
pm2 save
```

### 6. Deploy ครั้งถัดไป
```bash
bash deploy/scripts/deploy.sh   # pull + build + pm2 reload
```

### 7. Auto-deploy (GitHub Actions)
เมื่อ push ไป `main` และ CI ผ่าน จะ deploy อัตโนมัติผ่าน SSH  
ตั้งค่า Secrets + SSH key: [`../deploy/GITHUB-ACTIONS-DEPLOY.md`](../deploy/GITHUB-ACTIONS-DEPLOY.md)

## สถาปัตยกรรม Runtime
```
Internet → Nginx (443/SSL)
   ├─ /          → Next.js  127.0.0.1:3000
   ├─ /api/      → NestJS   127.0.0.1:4000
   └─ /socket.io → NestJS WS 127.0.0.1:4000
                      └── MySQL 127.0.0.1:3306
```

## แนวทางเพิ่มเติม (เฟส 8)
- ~~CI/CD ด้วย GitHub Actions (build + ssh deploy)~~ → มี workflow `deploy.yml` แล้ว (ต้องตั้ง GitHub Secrets)
- Monitoring: `pm2 monit` / logrotate
- Backup MySQL อัตโนมัติ (cron → `database/backups/`)
- Firewall: เปิดเฉพาะ 80/443/22
