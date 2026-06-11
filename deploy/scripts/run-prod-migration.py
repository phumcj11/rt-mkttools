#!/usr/bin/env python3
"""Run a SQL migration on the VPS production DB over SSH.

Usage (PowerShell):
    $env:VPS_SSH_PASSWORD="..."; python deploy/scripts/run-prod-migration.py database/migrations/2026_06_phase7_branches.sql

Reads DB credentials from the deployed app's .env on the VPS, so no DB
secret is needed locally. Uses `mysql --force` so re-running is safe
(duplicate-column errors are ignored).
"""
import os
import sys

try:
    import paramiko
except ImportError:
    print("Install paramiko: pip install paramiko")
    sys.exit(1)

HOST = os.environ.get("VPS_HOST", "119.59.102.235")
USER = os.environ.get("VPS_USER", "root")
PASSWORD = os.environ.get("VPS_SSH_PASSWORD", "")
APP_DIR = os.environ.get("VPS_APP_DIR", "/var/www/rt_mkttools")
MIGRATION = sys.argv[1] if len(sys.argv) > 1 else "database/migrations/2026_06_phase7_branches.sql"

if not PASSWORD:
    print("Set VPS_SSH_PASSWORD environment variable first.")
    sys.exit(1)

# Source the app .env, then pipe the migration file into mysql (--force = continue on error)
remote_cmd = (
    f"cd {APP_DIR} && set -a && . ./.env && set +a && "
    f"mysql --force -u\"$DB_USERNAME\" -p\"$DB_PASSWORD\" \"$DB_DATABASE\" < {MIGRATION} && "
    "echo MIGRATION_OK"
)

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(HOST, username=USER, password=PASSWORD, timeout=20, allow_agent=False, look_for_keys=False)
_, stdout, stderr = client.exec_command(remote_cmd)
out = stdout.read().decode().strip()
err = stderr.read().decode().strip()
client.close()
print("STDOUT:", out or "(empty)")
print("STDERR:", err or "(empty)")
