#!/usr/bin/env bash
# ============================================================
#  ร้าน 100 บาท — Server provisioning (AlmaLinux 9)
#  ติดตั้ง Node.js, MySQL, Nginx, PM2, certbot
#  รันด้วยสิทธิ์ root ครั้งแรกเท่านั้น
# ============================================================
set -euo pipefail

echo "==> Updating system"
dnf update -y

echo "==> Installing Node.js 20 (NodeSource)"
curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -
dnf install -y nodejs git

echo "==> Installing MySQL server"
dnf install -y mysql-server
systemctl enable --now mysqld

echo "==> Installing Nginx"
dnf install -y nginx
systemctl enable --now nginx

echo "==> Installing PM2 globally"
npm install -g pm2
pm2 startup systemd

echo "==> Installing certbot (Let's Encrypt)"
dnf install -y certbot python3-certbot-nginx

echo "==> Provision complete. Next: clone repo to /var/www/rt_mkttools"
