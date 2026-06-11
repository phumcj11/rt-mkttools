#!/usr/bin/env bash
# ============================================================
#  ร้าน 100 บาท — Deploy script (AlmaLinux)
#  ดึงโค้ดล่าสุด, build, แล้ว reload ผ่าน PM2
# ============================================================
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/rt_mkttools}"
cd "$APP_DIR"

echo "==> Pulling latest from GitHub"
git pull origin main

echo "==> Installing dependencies"
npm install

# Next.js ฝัง NEXT_PUBLIC_* ตอน build — ต้องโหลด .env ก่อน build frontend
if [ -f .env ]; then
  echo "==> Loading .env for build"
  set -a
  # shellcheck disable=SC1091
  . ./.env
  set +a
fi

echo "==> Building backend (NestJS)"
npm run build:backend

echo "==> Building frontend (Next.js)"
npm run build:frontend

echo "==> Reloading PM2"
pm2 reload deploy/pm2/ecosystem.config.js --env production
pm2 save

echo "==> Done."
