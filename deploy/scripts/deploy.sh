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
  # Next.js workspace build อ่าน .env จาก frontend/ — sync NEXT_PUBLIC_* ให้ชัวร์
  grep '^NEXT_PUBLIC_' .env > frontend/.env.production.local 2>/dev/null || true
fi

echo "==> Running pending SQL migrations"
DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-3306}"
DB_USER="${DB_USER:-mkttools}"
DB_PASS="${DB_PASSWORD:-}"
DB_NAME="${DB_NAME:-mkttools_db}"
for sql_file in "$APP_DIR"/database/migrations/*.sql; do
  migname=$(basename "$sql_file")
  rows=$(mysql -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USER" -p"$DB_PASS" "$DB_NAME" \
    -sse "SELECT COUNT(*) FROM _applied_migrations WHERE name='$migname' LIMIT 1;" 2>/dev/null || echo 0)
  if [ "$rows" = "0" ]; then
    echo "    Applying $migname ..."
    mysql -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USER" -p"$DB_PASS" "$DB_NAME" < "$sql_file"
    mysql -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USER" -p"$DB_PASS" "$DB_NAME" \
      -e "CREATE TABLE IF NOT EXISTS _applied_migrations (name VARCHAR(255) PRIMARY KEY, applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP); INSERT IGNORE INTO _applied_migrations (name) VALUES ('$migname');"
    echo "    Done: $migname"
  else
    echo "    Already applied: $migname"
  fi
done

echo "==> Building backend (NestJS)"
npm run build:backend

echo "==> Building frontend (Next.js)"
npm run build:frontend

echo "==> Reloading PM2"
pm2 reload deploy/pm2/ecosystem.config.js --env production
pm2 save

echo "==> Done."
