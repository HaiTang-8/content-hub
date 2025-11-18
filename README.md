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
### 1) 启动后端
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

### 2) 启动前端
```bash
cd content-hub/web
npm install
# 可选：复制环境变量模板
cp .env.example .env
# 如需自定义 API 地址或端口，编辑 .env（示例见 .env.example）
npm run dev -- --host
```
默认开发端口 `5173`，接口地址可在 `.env` 配置 `VITE_API_URL`（默认 `http://localhost:8080/api`）。

### 3) 登录 & 权限
- 首次启动会自动种子管理员账号：`admin / admin123`（可通过环境变量覆盖）。
- 管理员：创建用户。
- 普通用户：上传/查看/下载/分享。

## API 摘要
- `POST /api/login` 登录，返回 token。
- 需登录：
  - `GET /api/files` 列表
  - `POST /api/files` 上传文件或文字（multipart：file? + text? + description?）
  - `GET /api/files/:id/download` 下载
  - `GET /api/files/:id/stream` 预览
  - `POST /api/files/:id/share` 生成分享 token
  - 管理员：`POST /api/admin/users` 创建用户
- 公共分享：`GET /share/:token` 直接下载

## 设计要点
- 分层：`config/` `database/` `models/` `middleware/` `handlers/` `routes/`，便于后续扩展（如对象存储、审计日志、版本化等）。
- 存储：默认 SQLite + 本地文件夹 `uploads/`，可替换为其他数据库/对象存储。
- 安全：JWT 鉴权，中间件分离；管理员校验单独中间件。
- 响应式：React 前端 + Tailwind + Shadcn 组件，移动/桌面统一设计；Zustand 全局状态，Axios + React Router 处理导航与请求。

## 后续可扩展
- 文件搜索/标签、分片上传、OSS/S3 存储、下载限速/次数、分享过期时间、审计日志、WebSocket 进度等。
