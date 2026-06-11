#!/usr/bin/env python3
"""Install GitHub Actions deploy public key on VPS (requires VPS_SSH_PASSWORD env)."""
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
PUB_PATH = os.path.expanduser("~/.ssh/rt_mkttools_github_actions.pub")

if not PASSWORD:
    print("Set VPS_SSH_PASSWORD environment variable first.")
    sys.exit(1)

pub = open(PUB_PATH, encoding="utf-8").read().strip()
cmd = (
    "mkdir -p ~/.ssh && chmod 700 ~/.ssh && "
    f"grep -Fq '{pub.split()[1]}' ~/.ssh/authorized_keys 2>/dev/null || "
    f"echo '{pub}' >> ~/.ssh/authorized_keys && "
    "chmod 600 ~/.ssh/authorized_keys && echo ok"
)

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(HOST, username=USER, password=PASSWORD, timeout=15, allow_agent=False, look_for_keys=False)
_, stdout, stderr = client.exec_command(cmd)
out = stdout.read().decode().strip()
err = stderr.read().decode().strip()
client.close()
print(out or err or "done")
