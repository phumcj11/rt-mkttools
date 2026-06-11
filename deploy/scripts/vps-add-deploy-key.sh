#!/usr/bin/env bash
# รันบน VPS (root) เพื่อเพิ่ม public key สำหรับ GitHub Actions deploy
# ใช้: bash vps-add-deploy-key.sh 'ssh-ed25519 AAAA... comment'
set -euo pipefail

PUBKEY="${1:-}"
if [ -z "$PUBKEY" ]; then
  echo "Usage: bash $0 'ssh-ed25519 AAAA... github-actions-rt-mkttools'"
  exit 1
fi

mkdir -p ~/.ssh
chmod 700 ~/.ssh
grep -Fq "$PUBKEY" ~/.ssh/authorized_keys 2>/dev/null || echo "$PUBKEY" >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
echo "Deploy key installed."
