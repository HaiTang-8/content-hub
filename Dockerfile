# syntax=docker/dockerfile:1

# 选择可变的构建版本，便于在未来 Go/Node 升级时只改一次。
ARG GO_VERSION=1.24
ARG NODE_VERSION=22

# -------- 前端构建阶段：产出 dist 供后端 embed --------
FROM node:${NODE_VERSION}-alpine AS frontend
WORKDIR /app/web
# 单独复制依赖描述文件，利用 Docker 缓存加速重复构建。
COPY web/package*.json ./
RUN npm ci
# 拉入剩余前端源码并编译为静态资源。
COPY web .
ARG VITE_API_URL=/api
ENV VITE_API_URL=${VITE_API_URL}
RUN npm run build

# -------- 后端构建阶段：编译包含前端资源的二进制 --------
FROM golang:${GO_VERSION}-alpine AS builder
# 使用本地 Go 版本，避免在构建机上额外下载 toolchain。
ENV CGO_ENABLED=1 \
    GOFLAGS="-trimpath" \
    GOTOOLCHAIN=local
WORKDIR /app
# SQLite 依赖需要 CGO，安装基础构建工具与头文件。
RUN apk add --no-cache build-base sqlite-dev
# 预先下载依赖，减少后续变动导致的缓存失效。
COPY server/go.mod server/go.sum ./server/
WORKDIR /app/server
RUN go mod download
# 复制完整后端源码。
COPY server .
# 用最新前端构建产物覆盖 embed 路径，确保最终二进制自带 UI。
RUN rm -rf frontend/ui && mkdir -p frontend/ui
COPY --from=frontend /app/web/dist/ ./frontend/ui/
# 编译最终可执行文件。
RUN go build -o /app/bin/content-hub .

# -------- 运行时阶段：仅保留最小依赖的镜像 --------
FROM alpine:3.20 AS runtime
# 运行时仅保留必要依赖；su-exec 用于启动时降权与动态修复卷权限。
RUN apk add --no-cache ca-certificates sqlite-libs tzdata wget su-exec
ENV PORT=8080 \
    DB_PATH=/var/lib/content-hub/data/app.db \
    UPLOAD_DIR=/var/lib/content-hub/uploads \
    ALLOW_ORIGIN=* \
    JWT_SECRET=change-me \
    GIN_MODE=release
WORKDIR /app
# 拷贝编译好的二进制与入口脚本。
COPY --from=builder /app/bin/content-hub /usr/local/bin/content-hub
COPY entrypoint.sh /usr/local/bin/entrypoint.sh
# 创建运行所需目录和非 root 用户，降低容器权限风险。
RUN addgroup -S contenthub && adduser -S contenthub -G contenthub \
    && mkdir -p /var/lib/content-hub/data /var/lib/content-hub/uploads /var/log/content-hub \
    && chown -R contenthub:contenthub /var/lib/content-hub /var/log/content-hub \
    && chmod +x /usr/local/bin/entrypoint.sh
EXPOSE 8080
VOLUME ["/var/lib/content-hub"]
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["content-hub"]
