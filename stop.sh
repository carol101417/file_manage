#!/usr/bin/env bash
# Stop the file sharing service
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR/backend"

if command -v pm2 &>/dev/null && pm2 list 2>/dev/null | grep -q file-share; then
  pm2 stop file-share
  echo "[OK] Service stopped (PM2)"
elif [ -f .pid ]; then
  PID=$(cat .pid)
  if kill -0 "$PID" 2>/dev/null; then
    kill "$PID"
    rm -f .pid
    echo "[OK] Service stopped (PID: $PID)"
  else
    rm -f .pid
    echo "[WARN] Process was not running"
  fi
else
  echo "[WARN] No running service found"
fi
