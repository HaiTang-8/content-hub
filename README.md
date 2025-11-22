# Content Hub

一个简洁的文件/文字分享空间，支持：登录、角色权限（管理员/普通用户）、文件或文字上传、查看、下载、生成分享链接，兼容桌面与移动端浏览器。

## 技术栈
- 后端：Go (Gin + GORM + SQLite) + JWT 认证
- 前端：React + Vite + React Router + Zustand + Axios + Tailwind CSS (Shadcn UI 风格)

## 目录结构
```
content-hub/
├── server/      # Go 后端服务
├── web/         # React 前端 (Vite + Tailwind/Shadcn)
└── README.md
```

## 快速开始
### 1) Docker 方式（推荐）
- 本地单机运行（需 Docker 与 docker compose v2）：  
  ```bash
  docker compose build          # 构建包含前后端的镜像
  docker compose up -d          # 后台启动，默认 8080:8080
  ```
  > 配置均写在 `docker-compose.yml` 中，默认允许域名 `https://example.com`，请在部署前修改 `ALLOW_ORIGIN` 和 `JWT_SECRET`。

- 使用远程镜像（不依赖源码）：删除 compose 的 `build` 段，改为  
  ```yaml
  image: docker.io/<your-namespace>/content-hub:1.0.0
  ```
  然后执行 `docker compose pull && docker compose up -d`。

- 推送到公有仓库（Docker Hub 示例）：  
  ```bash
  docker build -t docker.io/<user>/content-hub:1.0.0 .
  docker push docker.io/<user>/content-hub:1.0.0
  ```
  多架构推送可用 `docker buildx build --platform linux/amd64,linux/arm64 --push ...`。

- GitHub Actions 自动推送镜像：`.github/workflows/docker-publish.yml`  
  触发 `main` 分支、`v*` 标签或手动 dispatch，会构建多架构镜像并推送到 Docker Hub（需在仓库 Secrets 设置 `DOCKERHUB_USERNAME` 与 `DOCKERHUB_TOKEN`）。如需 GHCR，将 `REGISTRY/IMAGE_NAME` 改为 `ghcr.io/<org>/<repo>`。

### 2) 启动后端（源码方式）
```bash
cd content-hub/server
# 可选：设置环境变量
export PORT=8080
export DB_PATH=data/app.db
export JWT_SECRET=replace-me
export ADMIN_USER=admin
export ADMIN_PASS=admin123
export UPLOAD_DIR=uploads

# 运行
go run .
```
服务默认监听 `http://localhost:8080`，API 在 `/api`，文件分享公开路由 `/share/:token`。

### 3) 启动前端
```bash
cd content-hub/web
npm install
# 可选：复制环境变量模板
cp .env.example .env
# 如需自定义 API 地址或端口，编辑 .env（示例见 .env.example）
npm run dev -- --host
```
默认开发端口 `5173`，接口地址可在 `.env` 配置 `VITE_API_URL`（默认 `http://localhost:8080/api`）。

### 4) 一键打包单可执行文件
```bash
chmod +x build_release.sh
./build_release.sh             # 默认生成 dist/content-hub，前端 API 基座注入 /api（同源）
# 可选：OUTPUT_DIR=./bin OUTPUT_NAME=content-hub-linux GOOS=linux GOARCH=amd64 ./build_release.sh
```
脚本会先执行 `npm install && npm run build`，将 `web/dist` 复制到 `server/frontend/ui` 并编译出带前端的 Go 二进制。运行产物只需正确配置后端环境变量即可（参考上方启动后端章节）。

> 跨平台提示：SQLite 驱动依赖 cgo，跨平台构建（如在 macOS 生成 Linux 版）需要目标平台的交叉编译工具链并设置 `CC`，例如 `CC=x86_64-linux-gnu-gcc GOOS=linux GOARCH=amd64 ./build_release.sh`，或在对应平台/容器内运行脚本。

### 5) CI 自动出包
- GitHub Actions 工作流：`.github/workflows/release.yml`
- 触发：推送 `v*` 标签（自动创建 Release 并上传产物）或手动 `workflow_dispatch`（仅上传 workflow artifacts）
- 产出：
  - Linux: `content-hub-linux-amd64`、`content-hub-linux-arm64`
  - macOS: `content-hub-darwin-arm64`
  - Windows: `content-hub-windows-amd64.exe`（Ubuntu 上用 mingw-w64 交叉编译）
  全部内置前端，下载后直接运行（配置后端环境变量即可）。

### 6) 登录 & 权限
- 首次启动会自动种子管理员账号：`admin / admin123`（可通过环境变量覆盖）。
- 管理员：创建用户。
- 普通用户：上传/查看/下载/分享。

## API 摘要
- `POST /api/login` 登录，返回 token。
- 需登录：
  - `GET /api/files` 列表
  - `POST /api/files` 上传文件或文字（multipart：file? + text? + description?）；亦支持携带 `X-API-Key` 进行匿名上传，需包含 `files:upload` scope
  - `GET /api/files/:id/download` 下载
  - `GET /api/files/:id/stream` 预览
  - `POST /api/files/:id/share` 生成分享 token
  - 管理员：`GET/POST/DELETE /api/admin/apikeys` 管理 API Key（绑定归属用户，支持过期与撤销）
  - 管理员：`POST /api/admin/users` 创建用户
- 公共分享：`GET /share/:token` 直接下载

## 设计要点
- 分层：`config/` `database/` `models/` `middleware/` `handlers/` `routes/`，便于后续扩展（如对象存储、审计日志、版本化等）。
- 存储：默认 SQLite + 本地文件夹 `uploads/`，可替换为其他数据库/对象存储。
- 安全：JWT 鉴权，中间件分离；管理员校验单独中间件。
- 响应式：React 前端 + Tailwind + Shadcn 组件，移动/桌面统一设计；Zustand 全局状态，Axios + React Router 处理导航与请求。

## 后续可扩展
- 文件搜索/标签、分片上传、OSS/S3 存储、下载限速/次数、分享过期时间、审计日志、WebSocket 进度等。
