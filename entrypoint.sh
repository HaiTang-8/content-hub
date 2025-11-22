#!/bin/sh
# 入口脚本：保证挂载卷的权限与目录就绪后再以非 root 用户运行二进制。
# 这样无论 docker-compose 的卷挂载到哪里，都能自动创建目录并修正属主。
set -e

# 默认路径与运行时保持一致，允许用户通过环境变量覆盖。
ROOT_DIR=${ROOT_DIR:-/var/lib/content-hub}
DB_PATH=${DB_PATH:-${ROOT_DIR}/data/app.db}
UPLOAD_DIR=${UPLOAD_DIR:-${ROOT_DIR}/uploads}

# 确保父目录存在，避免因卷覆盖导致权限不足。
mkdir -p "$ROOT_DIR" "$(dirname "$DB_PATH")" "$UPLOAD_DIR"

# 将持久化目录授权给运行用户（UID/GID 1000:1000）。
chown -R contenthub:contenthub "$ROOT_DIR"

# 切换到非 root 身份运行真正的服务。
exec su-exec contenthub:contenthub "$@"
