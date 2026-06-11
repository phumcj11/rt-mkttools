# Deploy — AlmaLinux + Nginx + PM2

แนวทาง deploy แพลตฟอร์ม AI การตลาดร้าน 100 บาท บน VPS

## โครงสร้าง
```
deploy/
├── nginx/
│   └── rt_mkttools.conf       # reverse proxy + SSL (สำหรับ Nginx)
├── apache/
│   └── rt_mkttools-proxy.conf # reverse proxy (สำหรับ DirectAdmin/Apache)
├── pm2/
│   └── ecosystem.config.js    # process definitions (backend cluster + frontend)
├── scripts/
│   ├── bootstrap.sh           # ⭐ one-shot: ติดตั้ง+โค้ด+DB+build+PM2+proxy
│   ├── provision.sh           # ติดตั้ง Node/MySQL/Nginx/PM2/certbot (VPS เปล่า)
│   └── deploy.sh              # pull + build + pm2 reload (ใช้ deploy รอบถัดไป)
└── systemd/                   # (optional) unit files
```

## วิธีที่ง่ายที่สุด — bootstrap ครั้งเดียวจบ ⭐
รันบน VPS ด้วย root:
```bash
# ครั้งแรก: clone repo ลงมาก่อน (หรือให้สคริปต์ clone ให้ก็ได้)
curl -fsSL https://raw.githubusercontent.com/phumcj11/rt-mkttools/main/deploy/scripts/bootstrap.sh -o /tmp/bootstrap.sh
sudo bash /tmp/bootstrap.sh
```
- รอบแรกสคริปต์จะ clone repo + สร้าง `.env` แล้ว **หยุด** ให้แก้ค่า secret
  (`DB_PASSWORD`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `OPENAI_API_KEY`)
  สร้าง secret: `openssl rand -hex 32`
- แก้เสร็จรันซ้ำ: `sudo bash /var/www/rt_mkttools/deploy/scripts/bootstrap.sh`
  สคริปต์จะสร้าง DB + import schema/seed + build + สตาร์ท PM2 + แนะนำ proxy
- ถ้า MySQL admin ไม่ใช่ socket-root ให้ส่งค่า:
  `sudo MYSQL_ADMIN_USER=root MYSQL_ADMIN_PASSWORD='xxx' bash deploy/scripts/bootstrap.sh`

สคริปต์เป็น **idempotent** — รันซ้ำได้ ใช้เป็น deploy รอบถัดไปก็ได้

## ทำให้ออนไลน์ที่ rt.k-mkt.com (เช็คลิสต์)
1. **DNS**: เพิ่ม A record `rt.k-mkt.com → <IP ของ VPS>` (ที่ผู้ให้บริการโดเมน/DirectAdmin DNS)
2. **bootstrap**: รันสคริปต์ด้านบนให้แอปขึ้น PM2
3. **Reverse proxy + SSL**:
   - **DirectAdmin/Apache** (เครื่องนี้): วางบล็อก proxy จาก `deploy/apache/rt_mkttools-proxy.conf`
     ลงใน *Custom HTTPD Configurations* ของโดเมน แล้วออก SSL (Let's Encrypt) ผ่าน DirectAdmin
   - **Nginx**: `cp deploy/nginx/rt_mkttools.conf /etc/nginx/conf.d/` → `certbot --nginx -d rt.k-mkt.com`

## สถาปัตยกรรม Runtime
```
Internet → Nginx (443) ─┬─ /          → Next.js  (127.0.0.1:3000)
                        ├─ /api/      → NestJS   (127.0.0.1:4000)
                        └─ /socket.io → NestJS WS (127.0.0.1:4000)
                                          │
                                          └── MySQL (127.0.0.1:3306)
```

> รายละเอียดเต็ม: [`../docs/07-deployment.md`](../docs/07-deployment.md)
