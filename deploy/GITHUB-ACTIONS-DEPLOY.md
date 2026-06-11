# Auto-deploy ด้วย GitHub Actions

เมื่อตั้งค่าเสร็จ flow จะเป็น:

```
เครื่อง dev → git push main → GitHub CI (build) → Deploy to VPS (SSH) → pm2 reload
```

Production: https://rt.k-mkt.com

---

## ข้อกำหนดก่อนเริ่ม

1. VPS ต้อง bootstrap แล้ว (`/var/www/rt_mkttools` มีโค้ด + `.env` + PM2 รันอยู่)
2. Repo บน GitHub: https://github.com/phumcj11/rt-mkttools
3. ใช้ **SSH key** ไม่ใช่ password (ปลอดภัยกว่า)

---

## ขั้นที่ 1 — สร้าง SSH key สำหรับ GitHub Actions

บนเครื่องที่มี Git Bash หรือ Linux/macOS:

```bash
cd /path/to/rt-mkttools
bash deploy/scripts/setup-github-actions-ssh.sh
```

สคริปต์จะสร้าง key ที่ `~/.ssh/rt_mkttools_github_actions` และแสดงคำสั่งถัดไป

---

## ขั้นที่ 2 — ใส่ public key บน VPS

SSH เข้า VPS ด้วย root (ใช้ password ที่คุณเก็บไว้):

```bash
ssh root@119.59.102.235
```

แล้วเพิ่ม public key (คัดลอกจาก `.pub` ที่สร้างในขั้นที่ 1):

```bash
mkdir -p ~/.ssh && chmod 700 ~/.ssh
echo 'ssh-ed25519 AAAA... github-actions-rt-mkttools' >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
```

ทดสอบจากเครื่อง dev (ไม่ควรถาม password):

```bash
ssh -i ~/.ssh/rt_mkttools_github_actions root@119.59.102.235 "echo ok"
```

---

## ขั้นที่ 3 — ตั้ง GitHub Secrets

ไปที่ GitHub → **phumcj11/rt-mkttools** → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**

| Secret name | ค่า |
| --- | --- |
| `VPS_HOST` | `119.59.102.235` |
| `VPS_USER` | `root` |
| `VPS_SSH_KEY` | เนื้อหา private key ทั้งไฟล์ (`-----BEGIN OPENSSH PRIVATE KEY-----` … `-----END …`) |
| `VPS_PORT` | `22` *(optional)* |
| `VPS_APP_DIR` | `/var/www/rt_mkttools` *(optional)* |

---

## ขั้นที่ 4 — Push workflow ขึ้น GitHub

```powershell
cd C:\xampp\htdocs\mkttools
git add .github/workflows/deploy.yml deploy/
git commit -m "Add GitHub Actions auto-deploy to VPS"
git push origin main
```

---

## การทำงาน

| Event | ผลลัพธ์ |
| --- | --- |
| Push ไป `main` | รัน **CI** → ถ้าผ่าน → รัน **Deploy to VPS** |
| CI ล้ม | ไม่ deploy |
| Manual | Actions → **Deploy to VPS** → **Run workflow** |

บน VPS สคริปต์ `deploy/scripts/deploy.sh` จะ:

1. `git pull origin main`
2. `npm install`
3. `npm run build:backend` + `npm run build:frontend`
4. `pm2 reload` + `pm2 save`

---

## แก้ปัญหา

**Deploy ล้ม — Permission denied (publickey)**  
→ ตรวจ public key ใน `~/.ssh/authorized_keys` บน VPS และ secret `VPS_SSH_KEY`

**Deploy ล้ม — ไม่มีโฟลเดอร์ `/var/www/rt_mkttools`**  
→ รัน bootstrap บน VPS ก่อน: `bash deploy/scripts/bootstrap.sh`

**Deploy ล้ม — git pull ไม่ได้**  
→ บน VPS ต้อง clone repo ไว้แล้ว และ remote ชี้ GitHub

**อยาก deploy ทันทีโดยไม่รอ CI**  
→ Actions → Deploy to VPS → Run workflow

---

## ความปลอดภัย

- อย่าเก็บ SSH password ใน GitHub Secrets
- อย่า commit private key ลง repo
- แนะนำ disable SSH login ด้วย password หลังใช้ key ได้แล้ว
