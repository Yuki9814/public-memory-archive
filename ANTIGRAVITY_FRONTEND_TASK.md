# Antigravity Frontend Task

You are responsible for the frontend main draft for this repository.

## Repository

Path: `/Users/houxvke/Documents/互联网记忆`

Frontend app: `apps/web`

Backend/API contract and docs already exist:

- `frontend-spec.md`
- `content-guidelines.md`
- `moderation-checklist.md`
- `packages/shared/src/types.ts`
- `apps/api/src/routes/public.ts`

## Product

Build a polished Chinese website for a "公共事件长记忆档案馆".

It is not a gossip site, forum, hot-search list, or marketing page. It is a restrained public-event evidence archive.

Visual direction:

- calm, restrained, premium, archive-like
- investigative reporting feel
- high information density but not messy
- elegant long-reading detail pages
- no comment area, likes/dislikes, hot ranking, gender-camp ranking

## Required Pages

- 首页
- 事件列表页
- 事件详情页
- 搜索页
- 议题地图页
- 资料源页
- 方法论页
- 提交线索页
- 纠错页
- 举报页
- 后台事件编辑页
- 后台来源管理页
- 后台平台外链管理页
- 后台审核队列页
- 后台举报队列页

## Event Detail Order

The event detail page must render modules in this order:

1. EventHeader
2. NeutralSummary
3. CurrentStatus
4. OriginalSourceLinks
5. Timeline
6. ClaimMatrix
7. EvidenceCabinet
8. SourceList
9. WhatWeKnow
10. WhatIsDisputed
11. WhatNotToInfer
12. RevisionHistory
13. CorrectionCTA
14. ReportCTA

## OriginalSourceLinks

Title must be: `原始资料跳转`

Each card must show:

- platform
- contentKind
- title
- 80-160 Chinese character description
- authorDisplay
- publishedAt
- availabilityStatus
- neutral button `查看原帖`
- neutral button `查看存档`
- thumbnailUrl if available

External links open in a new tab. Do not use copy like `围观`, `去冲`, or anything mobilizing.

## Data

Use the existing API helpers and DTOs if useful:

- `GET /api/events`
- `GET /api/events/:slug`
- `GET /api/events/:slug/timeline`
- `GET /api/events/:slug/claims`
- `GET /api/events/:slug/sources`
- `GET /api/events/:slug/platform-links`
- `GET /api/events/:slug/versions`

The current `apps/web` is only a fallback shell. You may refactor or replace it, but keep it in React + Vite + TypeScript and keep API compatibility.

## Design Rules

- Build the actual app, not a marketing-only landing page.
- 首页第一屏 must have strong brand signal.
- Cards are allowed for repeated items, modals, and framed tools; do not nest cards inside cards.
- Use stable dimensions for badges, toolbar buttons, timeline markers, evidence cards, and platform cards.
- Use a restrained multi-color palette, not a one-note purple/slate/beige theme.
- Use lucide-react icons where suitable.
- Mobile responsive is required.
- Include loading, empty, and error states.
- Text must not overlap or overflow on mobile or desktop.

## Tone

All visible Chinese copy must be neutral and restrained.

Avoid:

- gender blame
- verdict-like language
- emotional judgment
- call-to-action harassment wording
- exposing private identity details

## Deliverable

Modify only frontend-related files unless absolutely necessary:

- `apps/web/src/**`
- `apps/web/index.html`
- `apps/web/package.json`
- `apps/web/vite.config.ts`
- frontend docs if needed

Do not rewrite backend, Prisma, docs, or lockfiles unless required for frontend build.

After changes, try:

```bash
pnpm exec tsc -p apps/web/tsconfig.json
pnpm --filter @memory-archive/web run build
```

If Vite/Rollup native module is blocked by macOS signature in this Codex environment, report that and still ensure TypeScript passes.
