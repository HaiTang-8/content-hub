#!/usr/bin/env bash

set -euo pipefail

# Build front-end (Vite) and backend (Go) into a single self-contained binary.
# Env vars:
#   VITE_API_URL   - API base injected at build time (default: /api for same-origin)
#   OUTPUT_DIR     - where the binary is written (default: ./dist)
#   OUTPUT_NAME    - binary file name (default: content-hub)
#   GOOS/GOARCH    - optional target (defaults to host go env)
#   CGO_ENABLED    - set to 0 only if using a pure-Go SQLite driver; sqlite here requires cgo
#   CC             - set when cross-compiling with cgo (e.g., x86_64-linux-gnu-gcc)

ROOT_DIR="$(cd -- "$(dirname "$0")" && pwd)"
WEB_DIR="$ROOT_DIR/web"
SERVER_DIR="$ROOT_DIR/server"
UI_DIR="$SERVER_DIR/frontend/ui"
OUTPUT_DIR=${OUTPUT_DIR:-"$ROOT_DIR/dist"}
OUTPUT_NAME=${OUTPUT_NAME:-"content-hub"}
VITE_API_URL=${VITE_API_URL:-"/api"}
TARGET_OS=${GOOS:-$(go env GOOS)}
TARGET_ARCH=${GOARCH:-$(go env GOARCH)}
HOST_OS=$(go env GOOS)

echo "[1/4] prepare embedded frontend directory: $UI_DIR"
rm -rf "$UI_DIR"
mkdir -p "$UI_DIR"

echo "[2/4] build frontend (VITE_API_URL=$VITE_API_URL)"
cd "$WEB_DIR"
npm install
VITE_API_URL="$VITE_API_URL" npm run build

echo "[3/4] copy frontend artifacts for go:embed"
cp -R "$WEB_DIR/dist/." "$UI_DIR/"

echo "[4/4] build Go binary"
cd "$SERVER_DIR"
mkdir -p "$OUTPUT_DIR"
if [ "$TARGET_OS" != "$HOST_OS" ] && [ "${CGO_ENABLED:-1}" = "1" ]; then
  echo "warning: cross-compiling with cgo for sqlite needs target toolchain (set CC for $TARGET_OS/$TARGET_ARCH)" >&2
fi

GOOS="$TARGET_OS" \
GOARCH="$TARGET_ARCH" \
CGO_ENABLED="${CGO_ENABLED:-1}" \
go build -o "$OUTPUT_DIR/$OUTPUT_NAME" .

echo "done: $OUTPUT_DIR/$OUTPUT_NAME"
