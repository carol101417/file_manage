# =====================================================
#  File Sharing System - Remote One-Line Installer
#  Usage: irm https://raw.githubusercontent.com/carol101417/file_manage/master/install.ps1 | iex
# =====================================================

$ErrorActionPreference = "Stop"

$INSTALL_DIR = if ($env:INSTALL_DIR) { $env:INSTALL_DIR } else { "$HOME\file_manage" }
$REPO_URL = "https://github.com/carol101417/file_manage.git"

function Write-Info($msg)  { Write-Host "[INFO]  $msg" -ForegroundColor Cyan }
function Write-Ok($msg)    { Write-Host "[OK]    $msg" -ForegroundColor Green }
function Write-Warn($msg)  { Write-Host "[WARN]  $msg" -ForegroundColor Yellow }
function Write-Fail($msg)  { Write-Host "[ERROR] $msg" -ForegroundColor Red; exit 1 }

Write-Host ""
Write-Host "========================================"
Write-Host "  File Sharing System - Quick Install"
Write-Host "========================================"
Write-Host ""
Write-Info "Install directory: $INSTALL_DIR"
Write-Host ""

# ---------- Check prerequisites ----------
Write-Info "Checking prerequisites..."

# Check git
try {
    $gitVer = git --version 2>$null
    if (-not $gitVer) { throw }
    Write-Ok "git detected"
} catch {
    Write-Fail "git is not installed. Please install git first: https://git-scm.com"
}

# Check Node.js
try {
    $nodeVer = node -v 2>$null
    if (-not $nodeVer) { throw }
    $major = [int]($nodeVer -replace 'v' -split '\.')[0]
    if ($major -lt 18) {
        Write-Fail "Node.js 18+ is required, current: $nodeVer"
    }
    Write-Ok "Node.js $nodeVer detected"
} catch {
    Write-Fail "Node.js is not installed. Please install Node.js 18+: https://nodejs.org"
}

# Check npm
try {
    $npmVer = npm -v 2>$null
    if (-not $npmVer) { throw }
    Write-Ok "npm $npmVer detected"
} catch {
    Write-Fail "npm is not found. Please reinstall Node.js."
}

# ---------- Clone or update repo ----------
if (Test-Path "$INSTALL_DIR\.git") {
    Write-Info "Existing installation found. Updating..."
    Set-Location $INSTALL_DIR
    git pull --ff-only
    Write-Ok "Repository updated"
} else {
    if ((Test-Path $INSTALL_DIR) -and (Get-ChildItem $INSTALL_DIR -Force | Measure-Object).Count -gt 0) {
        Write-Fail "$INSTALL_DIR already exists and is not empty. Remove it or set `$env:INSTALL_DIR."
    }
    Write-Info "Cloning repository..."
    git clone $REPO_URL $INSTALL_DIR
    Write-Ok "Repository cloned"
}

# ---------- Run deploy ----------
Set-Location $INSTALL_DIR

Write-Host ""
Write-Info "Installing backend dependencies..."
Set-Location "$INSTALL_DIR\backend"
npm install --production 2>$null | Out-Null
Write-Ok "Backend dependencies installed"

Write-Info "Installing frontend dependencies..."
Set-Location "$INSTALL_DIR\frontend"
npm install 2>$null | Out-Null
Write-Ok "Frontend dependencies installed"

Write-Info "Building frontend..."
npm run build 2>$null | Out-Null
if (-not (Test-Path "$INSTALL_DIR\frontend\dist")) {
    Write-Fail "Frontend build failed"
}
Write-Ok "Frontend built successfully"

# ---------- Setup .env ----------
Set-Location "$INSTALL_DIR\backend"

if (-not (Test-Path .env)) {
    Write-Info "Generating .env configuration..."
    $secret = node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"
    @"
PORT=3000
JWT_SECRET=$secret
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=524288000
DATABASE_PATH=./database.sqlite
NODE_ENV=production
CORS_ORIGIN=*
"@ | Set-Content .env -Encoding UTF8
    Write-Ok ".env file created with secure JWT_SECRET"
} else {
    $envContent = Get-Content .env -Raw
    if ($envContent -match "your-secret-key-change-this-in-production") {
        Write-Warn "Updating default JWT_SECRET..."
        $secret = node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"
        $envContent = $envContent -replace "JWT_SECRET=your-secret-key-change-this-in-production", "JWT_SECRET=$secret"
        $envContent = $envContent -replace "NODE_ENV=development", "NODE_ENV=production"
        $envContent | Set-Content .env -Encoding UTF8
        Write-Ok "JWT_SECRET updated"
    } else {
        Write-Ok ".env already configured"
    }
}

# Create uploads dir
if (-not (Test-Path "$INSTALL_DIR\backend\uploads")) {
    New-Item -ItemType Directory -Path "$INSTALL_DIR\backend\uploads" -Force | Out-Null
}
Write-Ok "Upload directory ready"

# ---------- Install and start with PM2 ----------
$usePM2 = $false
try {
    $pm2Ver = pm2 -v 2>$null
    if ($pm2Ver) { $usePM2 = $true }
} catch {}

if (-not $usePM2) {
    Write-Info "Installing PM2..."
    try {
        npm install -g pm2 2>$null | Out-Null
        $usePM2 = $true
        Write-Ok "PM2 installed"
    } catch {
        Write-Warn "PM2 install failed. Using plain Node.js."
    }
}

Set-Location "$INSTALL_DIR\backend"

if ($usePM2) {
    pm2 delete file-share 2>$null
    Write-Info "Starting server with PM2..."
    pm2 start src/app.js --name file-share --max-memory-restart 512M
    pm2 save 2>$null
    Write-Host ""
    pm2 status file-share
} else {
    Write-Info "Starting server..."
    Start-Process -NoNewWindow -FilePath "node" -ArgumentList "src/app.js" -RedirectStandardOutput "$INSTALL_DIR\backend\app.log" -RedirectStandardError "$INSTALL_DIR\backend\app-error.log"
    Start-Sleep -Seconds 3
}

# ---------- Health check ----------
$port = "3000"
Select-String -Path .env -Pattern "^PORT=(.+)" | ForEach-Object { $port = $_.Matches.Groups[1].Value.Trim() }

Start-Sleep -Seconds 2
try {
    $health = Invoke-RestMethod "http://localhost:$port/api/health" -TimeoutSec 5
    Write-Ok "Health check passed"
} catch {
    Write-Warn "Health check failed - server may still be starting"
}

# ---------- Done ----------
Write-Host ""
Write-Host "========================================"
Write-Host "  Deployment Complete!" -ForegroundColor Green
Write-Host "========================================"
Write-Host ""
Write-Host "  Access URL:    http://localhost:$port"
Write-Host "  Admin account: admin / Admin123!"
Write-Host ""
Write-Host "  IMPORTANT: Change the default password after first login!" -ForegroundColor Yellow
Write-Host ""
if ($usePM2) {
    Write-Host "  Management commands:"
    Write-Host "    pm2 status              - View status"
    Write-Host "    pm2 logs file-share     - View logs"
    Write-Host "    pm2 restart file-share  - Restart"
    Write-Host "    pm2 stop file-share     - Stop"
    Write-Host ""
}
