#!/usr/bin/env bash
# ============================================================
#  ร้าน 100 บาท — One-shot bootstrap/deploy (AlmaLinux + DirectAdmin หรือ VPS เปล่า)
#  รันด้วย root ครั้งเดียว เพื่อ:
#    1) ติดตั้ง prerequisites (git, Node 20, PM2)
#    2) ดึงโค้ดล่าสุดจาก GitHub
#    3) ตั้งค่า .env (ครั้งแรกจะหยุดให้แก้ secret ก่อน)
#    4) สร้างฐานข้อมูล MySQL + import schema + seed (idempotent)
#    5) build backend + frontend
#    6) สตาร์ท/รีโหลดด้วย PM2
#    7) ตั้งค่า reverse proxy (Nginx อัตโนมัติ / Apache+DirectAdmin = แนะนำขั้นตอน)
#
#  ใช้งาน:
#    sudo bash deploy/scripts/bootstrap.sh
#  ปรับค่าได้ผ่าน env เช่น:
#    sudo DOMAIN=rt.k-mkt.com APP_DIR=/var/www/rt_mkttools bash deploy/scripts/bootstrap.sh
# ============================================================
set -euo pipefail

# ---------- config (override ผ่าน environment ได้) ----------
APP_DIR="${APP_DIR:-/var/www/rt_mkttools}"
REPO_URL="${REPO_URL:-https://github.com/phumcj11/rt-mkttools.git}"
BRANCH="${BRANCH:-main}"
DOMAIN="${DOMAIN:-rt.k-mkt.com}"
NODE_MAJOR="${NODE_MAJOR:-20}"
# การเชื่อม MySQL ในฐานะ admin เพื่อสร้าง DB/user (ปรับได้)
MYSQL_ADMIN_USER="${MYSQL_ADMIN_USER:-root}"
MYSQL_ADMIN_PASSWORD="${MYSQL_ADMIN_PASSWORD:-}"

log()  { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }
warn() { printf '\033[1;33m[!] %s\033[0m\n' "$*"; }
die()  { printf '\033[1;31m[x] %s\033[0m\n' "$*" >&2; exit 1; }

[ "$(id -u)" = "0" ] || die "ต้องรันด้วย root (ใช้ sudo)"

# อ่านค่าตัวแปรจากไฟล์ .env (รองรับค่าใน \" \" และตัด \\r ท้ายบรรทัด)
# ใช้ `|| true` กัน set -e หยุดเมื่อ grep ไม่เจอ match
get_env() {
  local key="$1" file="${2:-$APP_DIR/.env}"
  [ -f "$file" ] || return 0
  { grep -E "^${key}=" "$file" || true; } | head -n1 | cut -d= -f2- | sed 's/^"//; s/"$//; s/\r$//'
}

mysql_admin() {
  if [ -n "$MYSQL_ADMIN_PASSWORD" ]; then
    mysql -u "$MYSQL_ADMIN_USER" -p"$MYSQL_ADMIN_PASSWORD" "$@"
  else
    mysql -u "$MYSQL_ADMIN_USER" "$@"
  fi
}

# ---------- 1) prerequisites ----------
install_prereqs() {
  log "ตรวจ/ติดตั้ง prerequisites (git, Node ${NODE_MAJOR}, PM2)"
  command -v git >/dev/null 2>&1 || dnf install -y git

  local need_node=1
  if command -v node >/dev/null 2>&1; then
    local cur; cur="$(node -v | sed 's/v//; s/\..*//')"
    [ "$cur" -ge "$NODE_MAJOR" ] && need_node=0
  fi
  if [ "$need_node" = "1" ]; then
    log "ติดตั้ง Node.js ${NODE_MAJOR} (NodeSource)"
    curl -fsSL "https://rpm.nodesource.com/setup_${NODE_MAJOR}.x" | bash -
    dnf install -y nodejs
  else
    log "พบ Node $(node -v) แล้ว — ข้าม"
  fi

  command -v pm2 >/dev/null 2>&1 || { log "ติดตั้ง PM2"; npm install -g pm2; }
}

# ---------- 2) code ----------
fetch_code() {
  if [ -d "$APP_DIR/.git" ]; then
    log "อัปเดตโค้ดใน $APP_DIR (git pull)"
    git -C "$APP_DIR" fetch origin "$BRANCH"
    git -C "$APP_DIR" checkout "$BRANCH"
    git -C "$APP_DIR" pull origin "$BRANCH"
  else
    log "Clone โค้ดไป $APP_DIR"
    mkdir -p "$(dirname "$APP_DIR")"
    git clone -b "$BRANCH" "$REPO_URL" "$APP_DIR"
  fi
}

# ---------- 3) .env ----------
ensure_env() {
  if [ ! -f "$APP_DIR/.env" ]; then
    log "สร้าง .env จากตัวอย่าง (deploy/.env.production.example)"
    cp "$APP_DIR/deploy/.env.production.example" "$APP_DIR/.env"
    chmod 600 "$APP_DIR/.env"
    warn "กรุณาแก้ค่า secret ใน $APP_DIR/.env (DB_PASSWORD, JWT_*, OPENAI_API_KEY)"
    warn "สร้าง secret: openssl rand -hex 32"
    warn "แก้เสร็จแล้วรันสคริปต์นี้ซ้ำอีกครั้ง"
    exit 0
  fi
  if grep -q "__CHANGE_ME__" "$APP_DIR/.env"; then
    die "ยังมีค่า __CHANGE_ME__ ใน .env — แก้ให้ครบก่อน แล้วรันใหม่"
  fi
  log ".env พร้อมใช้งาน"
}

# ---------- 4) database ----------
setup_db() {
  local db user pass
  db="$(get_env DB_DATABASE)"; user="$(get_env DB_USERNAME)"; pass="$(get_env DB_PASSWORD)"
  [ -n "$db" ] && [ -n "$user" ] && [ -n "$pass" ] || die "อ่านค่า DB_* จาก .env ไม่ครบ"

  command -v mysql >/dev/null 2>&1 || die "ไม่พบคำสั่ง mysql — ติดตั้ง MySQL/MariaDB ก่อน (DirectAdmin มีให้อยู่แล้ว)"

  log "สร้างฐานข้อมูล '$db' + ผู้ใช้ '$user'"
  if ! mysql_admin -e "SELECT 1" >/dev/null 2>&1; then
    die "เชื่อม MySQL ในฐานะ '$MYSQL_ADMIN_USER' ไม่ได้ — กำหนด MYSQL_ADMIN_USER/MYSQL_ADMIN_PASSWORD แล้วรันใหม่"
  fi
  mysql_admin <<SQL
CREATE DATABASE IF NOT EXISTS \`$db\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS '$user'@'localhost' IDENTIFIED BY '$pass';
ALTER USER '$user'@'localhost' IDENTIFIED BY '$pass';
GRANT ALL PRIVILEGES ON \`$db\`.* TO '$user'@'localhost';
FLUSH PRIVILEGES;
SQL

  local has_tables
  has_tables="$(mysql_admin -N -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='$db' AND table_name='tenants';")"
  if [ "$has_tables" = "0" ]; then
    log "Import schema (database/schema/schema.sql)"
    mysql_admin "$db" < "$APP_DIR/database/schema/schema.sql"
  else
    log "schema มีอยู่แล้ว — ข้าม import"
  fi

  local role_count
  role_count="$(mysql_admin -N -e "SELECT COUNT(*) FROM \`$db\`.roles;" 2>/dev/null || echo 0)"
  if [ "$role_count" = "0" ]; then
    log "Seed ข้อมูลเริ่มต้น (database/seeds/seed.sql)"
    mysql_admin "$db" < "$APP_DIR/database/seeds/seed.sql"
  else
    log "มี seed roles แล้ว — ข้าม"
  fi
}

# ---------- 5) build ----------
build_app() {
  cd "$APP_DIR"
  log "ติดตั้ง dependencies (npm install — workspaces)"
  npm install --no-audit --no-fund
  log "Build backend (NestJS)"
  npm run build:backend

  # Next.js inline ค่า NEXT_PUBLIC_* ตอน build และอ่านจากโฟลเดอร์ frontend
  # จึง export จาก root .env ให้ตอน build เพื่อให้ฝั่ง client เรียก API ผ่านโดเมนจริง
  log "Build frontend (Next.js)"
  export NEXT_PUBLIC_APP_URL="$(get_env NEXT_PUBLIC_APP_URL)"
  export NEXT_PUBLIC_API_URL="$(get_env NEXT_PUBLIC_API_URL)"
  export NEXT_PUBLIC_SOCKET_URL="$(get_env NEXT_PUBLIC_SOCKET_URL)"
  export NEXT_PUBLIC_DEFAULT_LOCALE="$(get_env NEXT_PUBLIC_DEFAULT_LOCALE)"
  npm run build:frontend
}

# ---------- 6) pm2 ----------
start_pm2() {
  cd "$APP_DIR"
  log "สตาร์ท/รีโหลดด้วย PM2"
  if pm2 describe mkttools-backend >/dev/null 2>&1; then
    pm2 reload deploy/pm2/ecosystem.config.js --env production
  else
    pm2 start deploy/pm2/ecosystem.config.js --env production
  fi
  pm2 save
  pm2 startup systemd -u root --hp /root >/dev/null 2>&1 || true
  log "สถานะ PM2:"
  pm2 status
}

# ---------- 7) reverse proxy ----------
setup_proxy() {
  local has_nginx=0 has_apache=0 is_da=0
  systemctl is-active --quiet nginx 2>/dev/null && has_nginx=1
  { systemctl is-active --quiet httpd 2>/dev/null || systemctl is-active --quiet apache2 2>/dev/null; } && has_apache=1
  [ -d /usr/local/directadmin ] && is_da=1

  if [ "$is_da" = "1" ] || { [ "$has_apache" = "1" ] && [ "$has_nginx" = "0" ]; }; then
    warn "ตรวจพบ Apache/DirectAdmin คุม port 80/443 อยู่ — ไม่แตะอัตโนมัติเพื่อความปลอดภัย"
    echo "    ใช้ไฟล์ reverse proxy: $APP_DIR/deploy/apache/rt_mkttools-proxy.conf"
    if [ "$is_da" = "1" ]; then
      echo "    DirectAdmin: เปิดโดเมน $DOMAIN → Custom HTTPD Configurations → วางบล็อก Proxy/Rewrite"
      echo "    จากนั้นออก SSL ผ่าน DirectAdmin (Let's Encrypt) ของโดเมน"
    else
      echo "    Apache ทั่วไป: cp ไฟล์ข้างต้นไป /etc/httpd/conf.d/ แล้ว systemctl reload httpd"
    fi
    echo "    ต้องเปิดโมดูล Apache: proxy proxy_http proxy_wstunnel rewrite"
  elif [ "$has_nginx" = "1" ]; then
    log "ตั้งค่า Nginx reverse proxy"
    cp "$APP_DIR/deploy/nginx/rt_mkttools.conf" /etc/nginx/conf.d/rt_mkttools.conf
    if nginx -t 2>/dev/null; then
      systemctl reload nginx
      echo "    Nginx โหลดค่าใหม่แล้ว — ออก SSL ด้วย: certbot --nginx -d $DOMAIN"
    else
      warn "nginx -t ไม่ผ่าน (อาจเพราะยังไม่มีใบ SSL) — ออกใบก่อน: certbot --nginx -d $DOMAIN"
    fi
  else
    warn "ไม่พบทั้ง Nginx และ Apache — ติดตั้ง web server แล้วใช้ไฟล์ใน deploy/{nginx,apache}/"
  fi
}

# ---------- run ----------
install_prereqs
fetch_code
ensure_env
setup_db
build_app
start_pm2
setup_proxy

log "เสร็จสิ้น 🎉"
echo "  - แอป Node รันแล้ว: frontend :3000, backend :4000 (ผ่าน PM2)"
echo "  - ตรวจสุขภาพ backend: curl -s http://127.0.0.1:4000/api/health"
echo "  - DNS: ชี้ A record $DOMAIN -> IP ของเครื่องนี้"
echo "  - เปิด reverse proxy + SSL ตามคำแนะนำด้านบน แล้วเข้าผ่าน https://$DOMAIN"
