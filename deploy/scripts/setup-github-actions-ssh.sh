#!/usr/bin/env bash
# ============================================================
#  สร้าง SSH key สำหรับ GitHub Actions → VPS auto-deploy
#  รันบนเครื่อง dev (Linux/macOS/Git Bash) — ไม่รันบน VPS
#
#  ใช้งาน:
#    bash deploy/scripts/setup-github-actions-ssh.sh
# ============================================================
set -euo pipefail

KEY_DIR="${KEY_DIR:-$HOME/.ssh}"
KEY_NAME="${KEY_NAME:-rt_mkttools_github_actions}"
KEY_PATH="$KEY_DIR/$KEY_NAME"

mkdir -p "$KEY_DIR"
chmod 700 "$KEY_DIR"

if [ -f "$KEY_PATH" ]; then
  echo "[!] พบ key เดิมแล้ว: $KEY_PATH"
  echo "    ลบก่อนถ้าต้องการสร้างใหม่: rm ${KEY_PATH} ${KEY_PATH}.pub"
  exit 1
fi

ssh-keygen -t ed25519 -C "github-actions-rt-mkttools" -f "$KEY_PATH" -N ""

echo ""
echo "==> 1) เพิ่ม public key บน VPS (รันคำสั่งนี้บนเครื่องคุณ หรือ SSH เข้า VPS แล้ววาง):"
echo ""
echo "ssh root@119.59.102.235 \"mkdir -p ~/.ssh && chmod 700 ~/.ssh && echo '$(cat "${KEY_PATH}.pub")' >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys\""
echo ""
echo "==> 2) ตั้ง GitHub Secrets ที่ repo phumcj11/rt-mkttools → Settings → Secrets and variables → Actions:"
echo ""
echo "  VPS_HOST        = 119.59.102.235"
echo "  VPS_USER        = root"
echo "  VPS_SSH_KEY     = (วาง private key ด้านล่างทั้งไฟล์)"
echo "  VPS_PORT        = 22            (optional)"
echo "  VPS_APP_DIR     = /var/www/rt_mkttools  (optional)"
echo ""
echo "==> Private key (คัดลอกไปใส่ secret VPS_SSH_KEY):"
echo ""
cat "$KEY_PATH"
echo ""
echo "[✓] Public key เก็บไว้ที่: ${KEY_PATH}.pub"
echo "[✓] Private key เก็บไว้ที่: $KEY_PATH"
echo ""
echo "⚠️  อย่า commit private key ขึ้น GitHub"
