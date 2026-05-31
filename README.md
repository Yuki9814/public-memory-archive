# 公共事件长记忆档案馆

一个克制、可追溯的公共事件证据档案系统。目标是长期记录事件如何发生、传播、回应、反转与收束，而不是做热点社区、评论区或性别阵营站。

## 定位

- 记录流程，不做情绪审判。
- 区分事实、说法、证据、争议和阶段性结论。
- 每条关键信息绑定来源。
- 不以性别归罪，不把个案上升为群体攻击。
- 支持修订历史、纠错入口、举报入口。
- 保护隐私，避免人肉、网暴和未成年人信息泄露。

## 结构

```text
apps/api        Fastify 公开 API 与 admin API
apps/worker     BullMQ 异步任务：抓取、快照、hash、链接检测、Wayback 预留
apps/web        Antigravity 前端主稿，包含公开页、详情页、提交/纠错/举报页和后台工作台
packages/db     Prisma schema、migration、client、seed
packages/shared 共享枚举、DTO、校验、RSS、预检文本工具
```

## 本地启动

```bash
cp .env.example .env
docker compose up -d postgres redis
pnpm install
DATABASE_URL="postgresql://archive:archive@localhost:5432/archive?schema=public" pnpm run db:generate
DATABASE_URL="postgresql://archive:archive@localhost:5432/archive?schema=public" pnpm run db:migrate
DATABASE_URL="postgresql://archive:archive@localhost:5432/archive?schema=public" pnpm run db:seed
pnpm run dev
```

默认地址：

- API: `http://localhost:4100`
- OpenAPI UI: `http://localhost:4100/docs`
- Web: `http://localhost:5173`

## 关键 API

公开 API：

- `GET /api/session`
- `POST /api/auth/admin-login`
- `POST /api/auth/logout`
- `GET /api/events`
- `GET /api/events/:slug`
- `GET /api/events/:slug/timeline`
- `GET /api/events/:slug/claims`
- `GET /api/events/:slug/sources`
- `GET /api/events/:slug/platform-links`
- `GET /api/events/:slug/versions`
- `GET /api/feed.xml`
- `GET /api/events/:slug/feed.xml`
- `POST /api/submissions`
- `POST /api/corrections`
- `POST /api/reports`

后台 API：

- `POST /admin/events`
- `PATCH /admin/events/:id`
- `POST /admin/events/:id/sources`
- `POST /admin/events/:id/platform-links`
- `POST /admin/sources/:id/capture`
- `GET /admin/tasks/:taskId`
- `POST /admin/events/:id/timeline`
- `POST /admin/events/:id/claims`
- `POST /admin/events/:id/evidence`
- `POST /admin/claims/:id/evidence-links`
- `POST /admin/events/:id/review`
- `POST /admin/events/:id/publish`
- `POST /admin/events/:id/unpublish`
- `GET /admin/review-tasks`
- `GET /admin/reports`
- `POST /admin/reports/:id/resolve`

AI 辅助 API 只返回 `suggestions`，不写数据库：

- `POST /admin/events/:id/ai/suggest-summary`
- `POST /admin/events/:id/ai/extract-timeline`
- `POST /admin/events/:id/ai/extract-claims`
- `POST /admin/sources/:id/ai/classify-type`
- `POST /admin/events/:id/ai/check-neutrality`

## 访问权限

所有访客默认都是 `GUEST`，不注册、不写入 `users` 表，可浏览公开档案、提交线索、纠错和举报。管理员通过 `ADMIN_PASSCODE` 登录，服务端签发 `pm_admin_session` HttpOnly Cookie；所有 `/admin/*` 与后台 AI 接口都会校验该 Cookie。种子数据只保留一个 `ADMIN` 用户，显示名为“馆长”。

## 发布预检

`POST /admin/events/:id/publish` 强制运行机器预检，不通过返回：

```json
{
  "error": "PUBLISH_PREFLIGHT_FAILED",
  "failedChecks": []
}
```

检查内容包含中性标题、煽动词、摘要、来源、时间线来源绑定、证据等级、关键主张证据、隐私级别、敏感信息、未成年人保护、平台外链说明、版本快照、纠错与举报入口。

## 前端协作

前端主视觉和页面主稿由 Antigravity 产出。当前 `apps/web` 已接入 Antigravity 重构稿，用于展示首页、事件索引、详情长阅读页、资料源页、方法论页、提交/纠错/举报页和后台工作台。后续继续保留 `frontend-spec.md` 中的数据契约。

事件详情页组件顺序：

`EventHeader -> NeutralSummary -> CurrentStatus -> OriginalSourceLinks -> Timeline -> ClaimMatrix -> EvidenceCabinet -> SourceList -> WhatWeKnow -> WhatIsDisputed -> WhatNotToInfer -> RevisionHistory -> CorrectionCTA -> ReportCTA`

## 验证

```bash
pnpm --filter @memory-archive/shared run build
pnpm --filter @memory-archive/db run build
pnpm --filter @memory-archive/api run build
pnpm --filter @memory-archive/worker run build
pnpm exec tsc -p apps/web/tsconfig.json
pnpm test
```

当前 Codex 桌面 Node 环境下，Vite 的 Rollup 原生二进制可能被 macOS 签名策略拦截；前端 TypeScript 校验可通过，完整 Vite build 需要换成本机普通 Node 或修复 Rollup native module 签名。
