# 07 — Deployment (AlmaLinux + Nginx + PM2)

## เป้าหมาย
รัน Next.js (frontend) และ NestJS (backend + Socket.io) บน VPS AlmaLinux
โดยมี Nginx เป็น reverse proxy + SSL และ PM2 จัดการ process

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
mysql -u root -p -e "CREATE DATABASE rt_mkttools CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
mysql -u root -p rt_mkttools < database/schema/schema.sql
mysql -u root -p rt_mkttools < database/seeds/seed.sql
```

### 3. โค้ดและ environment
```bash
cd /var/www && git clone https://github.com/phumcj11/rt-mkttools.git rt_mkttools
cd rt_mkttools && cp .env.example .env   # แก้ค่าจริง (DB, JWT, OPENAI_API_KEY)
npm install
```

### 4. Nginx
```bash
cp deploy/nginx/rt_mkttools.conf /etc/nginx/conf.d/
nginx -t && systemctl reload nginx
certbot --nginx -d rt.k-mkt.com
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

## สถาปัตยกรรม Runtime
```
Internet → Nginx (443/SSL)
   ├─ /          → Next.js  127.0.0.1:3000
   ├─ /api/      → NestJS   127.0.0.1:4000
   └─ /socket.io → NestJS WS 127.0.0.1:4000
                      └── MySQL 127.0.0.1:3306
```

## แนวทางเพิ่มเติม (เฟส 8)
- CI/CD ด้วย GitHub Actions (build + ssh deploy)
- Monitoring: `pm2 monit` / logrotate
- Backup MySQL อัตโนมัติ (cron → `database/backups/`)
- Firewall: เปิดเฉพาะ 80/443/22
