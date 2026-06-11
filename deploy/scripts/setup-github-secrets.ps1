# ตั้ง GitHub Actions Secrets สำหรับ auto-deploy
# ใช้: powershell -ExecutionPolicy Bypass -File deploy/scripts/setup-github-secrets.ps1
# ต้อง login gh ก่อน: gh auth login

$ErrorActionPreference = 'Stop'
$Repo = 'phumcj11/rt-mkttools'
$KeyPath = Join-Path $env:USERPROFILE '.ssh\rt_mkttools_github_actions'

if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
  Write-Error 'GitHub CLI (gh) not found. Install from https://cli.github.com/'
}

gh auth status 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
  Write-Error 'Run gh auth login first'
}

if (-not (Test-Path $KeyPath)) {
  Write-Error "SSH key not found: $KeyPath"
}

Write-Host 'Setting GitHub Secrets for' $Repo

gh secret set VPS_HOST --repo $Repo --body '119.59.102.235'
gh secret set VPS_USER --repo $Repo --body 'root'
gh secret set VPS_APP_DIR --repo $Repo --body '/var/www/rt_mkttools'
gh secret set VPS_PORT --repo $Repo --body '22'
Get-Content $KeyPath -Raw | gh secret set VPS_SSH_KEY --repo $Repo

Write-Host 'Done. Secrets: VPS_HOST, VPS_USER, VPS_SSH_KEY, VPS_APP_DIR, VPS_PORT'
