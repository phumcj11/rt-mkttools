# Deploy — AlmaLinux + Nginx + PM2

แนวทาง deploy แพลตฟอร์ม AI การตลาดร้าน 100 บาท บน VPS

## โครงสร้าง
```
deploy/
├── nginx/
│   └── rt_mkttools.conf       # reverse proxy + SSL (สำหรับ Nginx)
├── apache/
│   ├── rt_mkttools-proxy.conf # reverse proxy แบบ vhost (Apache ทั่วไป)
│   └── rt_mkttools.htaccess   # ⭐ .htaccess proxy (DirectAdmin subdomain — ใช้จริงบน prod)
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
   - **DirectAdmin/Apache** (เครื่องนี้ — วิธีที่ใช้จริง): คัดลอก `deploy/apache/rt_mkttools.htaccess`
     ไปเป็น `.htaccess` ที่ docroot ของ subdomain (`/home/<user>/domains/rt.k-mkt.com/public_html/.htaccess`)
   - **Nginx**: `cp deploy/nginx/rt_mkttools.conf /etc/nginx/conf.d/` → `certbot --nginx -d rt.k-mkt.com`

### ออก/ต่ออายุ SSL บน DirectAdmin สำหรับ "subdomain" (rt.k-mkt.com) — ข้อควรระวังที่เจอจริง
> rt.k-mkt.com เป็น **subdomain ของ k-mkt.com** ไม่ใช่โดเมนแยก จุดที่ทำให้ออกใบไม่ผ่าน:
1. **DNS ต้องชี้มาก่อน** — A record `rt.k-mkt.com → <IP>` ต้อง resolve สาธารณะแล้ว (เช็ค `dig +short rt.k-mkt.com @8.8.8.8`)
2. **เครื่องต้อง resolve ตัวเองได้** — DA pre-check รัน `curl` บนเครื่อง ถ้า resolve subdomain ไม่ได้จะขึ้น
   `... was skipped due to unreachable ... file`. แก้: เพิ่มใน `/etc/hosts`
   `echo '<IP> rt.k-mkt.com www.rt.k-mkt.com k-mkt.com www.k-mkt.com' >> /etc/hosts`
3. **.htaccess ต้องยกเว้น acme-challenge** — DA serve challenge จาก global Alias `/var/www/html/.well-known/acme-challenge`
   ถ้า proxy ดัก path นี้ไป Node จะล้ม (ดูบรรทัดในไฟล์ `.htaccess`)
4. **ออกใบให้ครอบทั้ง rt และ www.rt**:
   ```bash
   /usr/local/directadmin/scripts/letsencrypt.sh request rt.k-mkt.com,www.rt.k-mkt.com 4096
   ```
5. **บังคับ DA เขียน vhost ใหม่** ให้ใช้ใบที่เพิ่งออก (ไม่งั้นยังชี้ใบ default ของเซิร์ฟเวอร์):
   ```bash
   echo 'action=rewrite&value=httpd&user=<user>' >> /usr/local/directadmin/data/task.queue
   /usr/local/directadmin/dataskq d2000 && systemctl reload httpd
   ```
6. ตรวจ: `curl --resolve rt.k-mkt.com:443:<IP> -sI https://rt.k-mkt.com/` ต้องได้ HTTP 200 และ cert verify ผ่าน

## สถาปัตยกรรม Runtime
```
Internet → Nginx (443) ─┬─ /          → Next.js  (127.0.0.1:3000)
                        ├─ /api/      → NestJS   (127.0.0.1:4000)
                        └─ /socket.io → NestJS WS (127.0.0.1:4000)
                                          │
                                          └── MySQL (127.0.0.1:3306)
```

> รายละเอียดเต็ม: [`../docs/07-deployment.md`](../docs/07-deployment.md)
