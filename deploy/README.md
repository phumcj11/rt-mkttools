# Deploy — AlmaLinux + Nginx + PM2

แนวทาง deploy แพลตฟอร์ม AI การตลาดร้าน 100 บาท บน VPS

## โครงสร้าง
```
deploy/
├── nginx/
│   └── rt_mkttools.conf       # reverse proxy + SSL (frontend + api + socket.io)
├── pm2/
│   └── ecosystem.config.js    # process definitions (backend cluster + frontend)
├── scripts/
│   ├── provision.sh           # ติดตั้ง Node/MySQL/Nginx/PM2/certbot (ครั้งแรก)
│   └── deploy.sh              # pull + build + pm2 reload
└── systemd/                   # (optional) unit files
```

## ขั้นตอน Deploy (ภาพรวม)
1. **Provision** เซิร์ฟเวอร์ครั้งแรก: `bash deploy/scripts/provision.sh`
2. Clone repo ไปที่ `/var/www/rt_mkttools` แล้วตั้งค่า `.env`
3. ตั้งค่า Nginx: คัดลอก `deploy/nginx/rt_mkttools.conf` ไป `/etc/nginx/conf.d/` แล้ว `nginx -t && systemctl reload nginx`
4. ออก SSL: `certbot --nginx -d app.example.com`
5. Deploy: `bash deploy/scripts/deploy.sh`

## สถาปัตยกรรม Runtime
```
Internet → Nginx (443) ─┬─ /          → Next.js  (127.0.0.1:3000)
                        ├─ /api/      → NestJS   (127.0.0.1:4000)
                        └─ /socket.io → NestJS WS (127.0.0.1:4000)
                                          │
                                          └── MySQL (127.0.0.1:3306)
```

> รายละเอียดเต็ม: [`../docs/07-deployment.md`](../docs/07-deployment.md)
