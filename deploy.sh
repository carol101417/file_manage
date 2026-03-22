#!/usr/bin/env bash
# =============================================================
#  Enterprise File Sharing System - One-Click Deploy (Linux/macOS)
# =============================================================
set -e

# ---------- Color helpers ----------
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

info()  { echo -e "${CYAN}[INFO]${NC}  $*"; }
ok()    { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
fail()  { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }

# ---------- Resolve project root ----------
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

echo ""
echo "========================================"
echo "  File Sharing System - Deploy Script"
echo "========================================"
echo ""

# ---------- 1. Check Node.js ----------
info "Checking Node.js..."
if ! command -v node &>/dev/null; then
  fail "Node.js is not installed. Please install Node.js 18+ first: https://nodejs.org"
fi

NODE_VER=$(node -v | sed 's/v//' | cut -d. -f1)
if [ "$NODE_VER" -lt 18 ]; then
  fail "Node.js 18+ is required, current version: $(node -v)"
fi
ok "Node.js $(node -v) detected"

# ---------- 2. Check npm ----------
if ! command -v npm &>/dev/null; then
  fail "npm is not found. Please reinstall Node.js."
fi
ok "npm $(npm -v) detected"

# ---------- 3. Install backend dependencies ----------
info "Installing backend dependencies..."
cd "$SCRIPT_DIR/backend"
npm install --production 2>&1 | tail -1
ok "Backend dependencies installed"

# ---------- 4. Install frontend dependencies & build ----------
info "Installing frontend dependencies..."
cd "$SCRIPT_DIR/frontend"
npm install 2>&1 | tail -1
ok "Frontend dependencies installed"

info "Building frontend..."
npm run build 2>&1 | tail -3
if [ ! -d "$SCRIPT_DIR/frontend/dist" ]; then
  fail "Frontend build failed - dist/ directory not found"
fi
ok "Frontend built successfully"

# ---------- 5. Setup .env ----------
cd "$SCRIPT_DIR/backend"

if [ ! -f .env ]; then
  info "Generating .env configuration..."

  # Generate random JWT secret
  if command -v openssl &>/dev/null; then
    JWT_SECRET=$(openssl rand -base64 48)
  else
    JWT_SECRET=$(head -c 48 /dev/urandom | base64 | tr -d '\n')
  fi

  cat > .env << ENVEOF
PORT=3000
JWT_SECRET=${JWT_SECRET}
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=524288000
DATABASE_PATH=./database.sqlite
NODE_ENV=production
CORS_ORIGIN=*
ENVEOF

  ok ".env file created with secure JWT_SECRET"
else
  # Check if JWT_SECRET is still the default
  if grep -q "your-secret-key-change-this-in-production" .env; then
    warn ".env exists but JWT_SECRET is still the default value!"

    if command -v openssl &>/dev/null; then
      JWT_SECRET=$(openssl rand -base64 48)
    else
      JWT_SECRET=$(head -c 48 /dev/urandom | base64 | tr -d '\n')
    fi

    sed -i.bak "s|JWT_SECRET=your-secret-key-change-this-in-production|JWT_SECRET=${JWT_SECRET}|" .env
    rm -f .env.bak
    ok "JWT_SECRET has been updated to a secure value"
  else
    ok ".env file already exists"
  fi

  # Ensure NODE_ENV=production
  if grep -q "NODE_ENV=development" .env; then
    sed -i.bak "s|NODE_ENV=development|NODE_ENV=production|" .env
    rm -f .env.bak
    ok "NODE_ENV set to production"
  fi
fi

# ---------- 6. Create required directories ----------
mkdir -p "$SCRIPT_DIR/backend/uploads"
ok "Upload directory ready"

# ---------- 7. Install PM2 (optional) ----------
USE_PM2=false
if command -v pm2 &>/dev/null; then
  USE_PM2=true
  ok "PM2 detected, will use PM2 for process management"
else
  info "PM2 not found. Installing globally for process management..."
  if npm install -g pm2 2>/dev/null; then
    USE_PM2=true
    ok "PM2 installed"
  else
    warn "PM2 install failed (may need sudo). Will use plain Node.js instead."
    warn "For production, consider: sudo npm install -g pm2"
  fi
fi

# ---------- 8. Start the server ----------
cd "$SCRIPT_DIR/backend"

# Stop existing instance if running
if [ "$USE_PM2" = true ]; then
  pm2 delete file-share 2>/dev/null || true
  info "Starting server with PM2..."
  pm2 start src/app.js --name file-share --max-memory-restart 512M
  pm2 save 2>/dev/null || true
  echo ""
  pm2 status file-share
else
  # Kill any existing node process on the port
  PORT=$(grep "^PORT=" .env | cut -d= -f2)
  PORT=${PORT:-3000}
  if lsof -i :"$PORT" -t &>/dev/null; then
    warn "Port $PORT is in use. Killing existing process..."
    kill $(lsof -i :"$PORT" -t) 2>/dev/null || true
    sleep 1
  fi

  info "Starting server with Node.js (nohup)..."
  nohup node src/app.js > "$SCRIPT_DIR/backend/app.log" 2>&1 &
  echo $! > "$SCRIPT_DIR/backend/.pid"
  sleep 2

  # Verify
  if kill -0 $(cat "$SCRIPT_DIR/backend/.pid") 2>/dev/null; then
    ok "Server started (PID: $(cat "$SCRIPT_DIR/backend/.pid"))"
  else
    fail "Server failed to start. Check backend/app.log for details."
  fi
fi

# ---------- 9. Health check ----------
PORT=$(grep "^PORT=" .env | cut -d= -f2)
PORT=${PORT:-3000}
sleep 1

if curl -sf "http://localhost:${PORT}/api/health" > /dev/null 2>&1; then
  ok "Health check passed"
else
  warn "Health check failed - server may still be starting up"
fi

# ---------- Done ----------
echo ""
echo "========================================"
echo -e "  ${GREEN}Deployment Complete!${NC}"
echo "========================================"
echo ""
echo "  Access URL:    http://localhost:${PORT}"
echo "  Admin account: admin / Admin123!"
echo ""
echo "  IMPORTANT: Change the default password after first login!"
echo ""
if [ "$USE_PM2" = true ]; then
  echo "  Management commands:"
  echo "    pm2 status          - View status"
  echo "    pm2 logs file-share - View logs"
  echo "    pm2 restart file-share - Restart"
  echo "    pm2 stop file-share - Stop"
  echo ""
  echo "  Enable auto-start on boot:"
  echo "    pm2 startup"
  echo "    pm2 save"
fi
echo ""
