#!/usr/bin/env bash
# =====================================================
#  File Sharing System - Remote One-Line Installer
#  Usage: curl -fsSL https://raw.githubusercontent.com/carol101417/file_manage/master/install.sh | bash
# =====================================================
set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
NC='\033[0m'

info()  { echo -e "${CYAN}[INFO]${NC}  $*"; }
ok()    { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
fail()  { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }

INSTALL_DIR="${INSTALL_DIR:-$HOME/file_manage}"
REPO_URL="https://github.com/carol101417/file_manage.git"

echo ""
echo "========================================"
echo "  File Sharing System - Quick Install"
echo "========================================"
echo ""
info "Install directory: $INSTALL_DIR"
echo ""

# ---------- Check prerequisites ----------
info "Checking prerequisites..."

# Check git
if ! command -v git &>/dev/null; then
  fail "git is not installed. Please install git first."
fi
ok "git $(git --version | awk '{print $3}') detected"

# Check Node.js
if ! command -v node &>/dev/null; then
  fail "Node.js is not installed. Please install Node.js 18+: https://nodejs.org"
fi

NODE_VER=$(node -v | sed 's/v//' | cut -d. -f1)
if [ "$NODE_VER" -lt 18 ]; then
  fail "Node.js 18+ is required, current: $(node -v)"
fi
ok "Node.js $(node -v) detected"

# Check npm
if ! command -v npm &>/dev/null; then
  fail "npm is not found."
fi
ok "npm $(npm -v) detected"

# ---------- Clone or update repo ----------
if [ -d "$INSTALL_DIR/.git" ]; then
  info "Existing installation found. Updating..."
  cd "$INSTALL_DIR"
  git pull --ff-only
  ok "Repository updated"
else
  if [ -d "$INSTALL_DIR" ] && [ "$(ls -A "$INSTALL_DIR" 2>/dev/null)" ]; then
    fail "$INSTALL_DIR already exists and is not empty. Remove it or set INSTALL_DIR."
  fi
  info "Cloning repository..."
  git clone "$REPO_URL" "$INSTALL_DIR"
  ok "Repository cloned"
fi

# ---------- Run deploy script ----------
cd "$INSTALL_DIR"
chmod +x deploy.sh
exec ./deploy.sh
