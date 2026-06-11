# ข้อมูลเซิร์ฟเวอร์ (Server / VPS) — 100 Baht Shop Thailand Marketing AI

> ⚠️ **ห้ามเก็บรหัสผ่าน/secret ในไฟล์นี้หรือใน repo** — เก็บไว้ใน password manager เท่านั้น
> รหัสผ่าน root ที่เคยส่งผ่านแชตควร **เปลี่ยนทันที** และเปลี่ยนไปใช้ SSH key

## โดเมน
| รายการ | ค่า |
| --- | --- |
| โดเมนหลัก (production) | `marketing.100bahtshopthailand.com` |
| Frontend URL | `https://marketing.100bahtshopthailand.com` |
| API URL | `https://marketing.100bahtshopthailand.com/api` |
| Socket.io URL | `https://marketing.100bahtshopthailand.com` (path `/socket.io`) |

## VPS / SSH
| รายการ | ค่า |
| --- | --- |
| IP Address | `119.59.102.235` |
| SSH User | `root` |
| Password | *(เก็บใน password manager — ไม่บันทึกที่นี่)* |
| Panel docroot | `/domains/rt.k-mkt.com/public_html` (DirectAdmin style) |

เชื่อมต่อ:
```bash
ssh root@119.59.102.235
# แนะนำ: ใช้ SSH key แทน password
#   ssh-copy-id root@119.59.102.235
```

## GitHub
| รายการ | ค่า |
| --- | --- |
| Repository | `https://github.com/phumcj11/rt-mkttools.git` |
| Owner | `phumcj11` |
| Branch หลัก | `main` |

## ตำแหน่งติดตั้งบน VPS (แนะนำ)
| รายการ | path |
| --- | --- |
| โค้ดแอป | `/var/www/rt_mkttools` |
| Frontend (Next.js) | port `3000` (proxy ผ่าน Nginx) |
| Backend (NestJS) | port `4000` (proxy `/api`, `/socket.io`) |
| ไฟล์ env production | `/var/www/rt_mkttools/.env` (จาก `.env.example`) |

## ฐานข้อมูล (MySQL)
| รายการ | ค่า |
| --- | --- |
| ชื่อ DB | `marketing_ai_100baht` (เปลี่ยนจาก `rt_mkttools` ใน Phase 8) |
| Charset | `utf8mb4_unicode_ci` |
| Migration ล่าสุด | `2026_06_phase8_new_modules.sql` |

> หมายเหตุ: ถ้า DB ยังชื่อ `rt_mkttools` อยู่ให้เปลี่ยน `DB_DATABASE` ใน `.env` production หลัง rename DB

> หมายเหตุ: เครื่องนี้ดูเหมือนใช้ control panel (DirectAdmin) ที่มี docroot
> `/domains/rt.k-mkt.com/public_html` — ถ้าใช้ Apache/LiteSpeed ของ panel ร่วมด้วย
> ต้องตั้ง reverse proxy ไปยังพอร์ต Node (3000/4000) หรือปิด vhost ของ panel
> แล้วใช้ Nginx config ใน `deploy/nginx/rt_mkttools.conf` แทน

## Auto-deploy (GitHub Actions)
เมื่อ push ไป `main` และ CI ผ่าน → workflow **Deploy to VPS** จะ SSH เข้าเครื่องแล้วรัน `deploy/scripts/deploy.sh`

ตั้งค่า Secrets ที่ GitHub repo → **Settings → Secrets and variables → Actions**:

| Secret | ตัวอย่าง |
| --- | --- |
| `VPS_HOST` | `119.59.102.235` |
| `VPS_USER` | `root` |
| `VPS_SSH_KEY` | private key (SSH key สำหรับ deploy — **ไม่ใช่** password) |
| `VPS_PORT` | `22` (optional) |
| `VPS_APP_DIR` | `/var/www/rt_mkttools` (optional) |
| `VPS_SSH_PASSWORD` | *(สำรอง — ใช้ SSH key แทน)* |

สร้าง SSH key: `bash deploy/scripts/setup-github-actions-ssh.sh`  
คู่มือเต็ม: [`GITHUB-ACTIONS-DEPLOY.md`](GITHUB-ACTIONS-DEPLOY.md)

## ขั้นตอน Deploy (manual)
ดู [`README.md`](README.md) และ [`../docs/07-deployment.md`](../docs/07-deployment.md)
```bash
bash deploy/scripts/provision.sh   # ครั้งแรก
bash deploy/scripts/deploy.sh      # ครั้งถัดไป
```
