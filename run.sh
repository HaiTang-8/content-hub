#!/usr/bin/env bash
# One-click start backend (Gin) and frontend (Vite) in the current shell.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
BACK="$ROOT/server"
WEB="$ROOT/web"

# Ports & endpoints
export PORT="${PORT:-8080}"
export VITE_API_URL="${VITE_API_URL:-http://localhost:${PORT}/api}"
FRONT_PORT="${FRONT_PORT:-5173}"

# Ensure frontend deps
if [ ! -d "$WEB/node_modules" ]; then
  echo "[setup] installing frontend deps..."
  (cd "$WEB" && npm install --registry=https://registry.npmmirror.com)
fi

# Ensure backend deps
if [ ! -d "$BACK"/data ]; then
  mkdir -p "$BACK/data"
fi

# Start backend
cd "$BACK"
PORT="$PORT" go run . &
BACK_PID=$!
echo "[backend] running on http://localhost:${PORT} (pid=$BACK_PID)"

# On exit, cleanup backend
cleanup() {
  echo "\n[cleanup] stopping backend (pid=$BACK_PID)"
  kill "$BACK_PID" 2>/dev/null || true
}
trap cleanup INT TERM EXIT

# Start frontend (foreground)
cd "$WEB"
echo "[frontend] starting Vite on http://localhost:${FRONT_PORT} (API=${VITE_API_URL})"
VITE_API_URL="$VITE_API_URL" npm run dev -- --host --port "$FRONT_PORT"
