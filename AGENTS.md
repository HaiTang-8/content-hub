# Repository Guidelines

## work
- 涉及文档相关的可以使用mcp中的mcp-router里面的tool,里面包含了context7和Playwright
- 涉及到组件样式的默认使用shadcnui和tailwindcss
- 最后的回答要有一段用于git提交的总结话语
- 必须使用中文回答
- 改动代码必须要有正确详细的代码注释
- 必须同时考虑移动端和桌面端

## Project Structure & Module Organization
Backend code sits in `server/`: `config/` stores env defaults, `database/` bootstraps SQLite, `routes/` wires controllers, `middleware/` enforces auth/logging, and domain types live in `models/` plus request logic in `handlers/`. Uploads land in `uploads/`; DB artifacts stay in `data/`. The React client lives in `web/`; feature code goes to `src/api`, `components`, `views`, `store`, and `hooks`, while static files sit in `public/` and builds in `dist/`.

## Build, Test, and Development Commands
- `./run.sh`: installs deps, exports `PORT`/`VITE_API_URL`, runs `go run .` on `8080`, and starts `npm run dev -- --host`.
- `cd server && go run .`: boot only the API; override `PORT`, `DB_PATH`, `JWT_SECRET`, `ADMIN_USER`, `ADMIN_PASS`, or `UPLOAD_DIR` as needed.
- `cd server && go test ./... -cover`: execute backend suites and keep table-driven tests fast (<60 s) for CI.
- `cd web && npm install && npm run dev`: install dependencies and serve the SPA on `5173`; use `npm run build && npm run preview` for release smoke tests and `npm run lint` before pushing.

## Coding Style & Naming Conventions
Run `gofmt`/`goimports`; keep handlers small, inject dependencies, and leave JSON tags in snake_case (`OwnerID` → `json:"owner_id"`). In React, components live in PascalCase files, hooks begin with `use`, Zustand slices expose narrow selectors, and Tailwind utility classes stay in JSX; rely on the shared ESLint config to settle formatting.

## Testing Guidelines
Attach `_test.go` files to backend changes, covering success, auth failure, and validation edges with `httptest.NewRecorder()` plus in-memory SQLite or a temp DB via `t.TempDir()`. The frontend currently lacks an automated runner; when Vitest + React Testing Library are added, place specs in `web/src/__tests__/` and simulate the login → upload → share path. Until then, include manual verification notes inside pull requests.

## Commit & Pull Request Guidelines
The provided snapshot omits `.git`, so seed the repo with Conventional Commits (e.g., `feat(server): add share expiry`) and keep scopes to `server` or `web`. Pull requests must summarize intent, list commands executed, link issues, attach screenshots or API output for user-facing changes, and flag env/config updates; request review whenever touching auth, persistence, or routing.

## Security & Configuration Tips
Keep `.env`, SQLite dumps, and the `uploads/` directory out of version control. Always set unique `JWT_SECRET` and `ADMIN_PASS` values, validate MIME types and file-size limits inside handlers, and document new environment variables in `README.md` so operators can recreate the stack safely.
