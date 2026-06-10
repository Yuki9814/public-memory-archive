# 前端数据契约

前端主稿由 Antigravity 生成。此文档定义页面与组件消费字段，供 Antigravity、API、worker 和联调共同遵守。

## 页面

- 首页：品牌第一屏、最新档案、资料完整度与更新度、方法论入口。
- 事件列表页：分页、搜索、议题、标签、状态、平台、日期、排序。
- 事件详情页：长阅读档案页，包含档案体检、锚点反馈、版本 diff。
- 搜索页：跨事件、来源、标签、平台检索。
- 议题地图页：按 topic 和 tag 组织事件。
- 资料源页：来源等级、平台外链、存档状态。
- 方法论页：证据等级、隐私与纠错规则。
- 提交线索页：调用 `POST /api/submissions`。
- 纠错页：调用 `POST /api/corrections`。
- 举报页：调用 `POST /api/reports`。
- 后台事件编辑页：调用 `/admin/events`。
- 后台来源管理页：调用 `/admin/events/:id/sources` 与 `/admin/sources/:id/capture`。
- 后台平台外链管理页：调用 `/admin/events/:id/platform-links`。
- 后台证据编辑页：调用 `/admin/events/:id/timeline`、`/admin/events/:id/claims`、`/admin/events/:id/evidence`、`/admin/claims/:id/evidence-links`。
- 后台审核队列页：调用 `/admin/review-tasks`。
- 后台举报队列页：调用 `/admin/reports` 与 `/admin/reports/:id/resolve`。
- 后台审计记录：调用 `/admin/audit-logs?entityType=&entityId=`。

## 事件详情页组件顺序

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

## EventHeader

Endpoint: `GET /api/events/:slug`

Fields:

- `id`
- `slug`
- `neutralTitle`
- `summary`
- `eventProcessStatus`
- `updatedAt`
- `topic.name`
- `tags[].label`
- `coverImage.url`
- `coverImage.alt`
- `coverImage.sourceUrl`
- `coverImage.sourceTitle`
- `coverImage.credit`
- `coverImage.verifiedAt`
- `coverImage.status`

Display rules:

- `coverImage` 只能来自原始平台缩略图或已完成存档截图。
- 没有 `coverImage` 时显示“暂无可核验配图”，不要使用装饰图、生成图或 Unsplash。

## HomepageEventCards

Endpoint: `GET /api/events`

Fields:

- `items[].id`
- `items[].slug`
- `items[].neutralTitle`
- `items[].summary`
- `items[].eventProcessStatus`
- `items[].updatedAt`
- `items[].sourceCount`
- `items[].timelineCount`
- `items[].platformLinkCount`
- `items[].coverImage.url`
- `items[].coverImage.alt`
- `items[].coverImage.sourceUrl`
- `items[].coverImage.sourceTitle`
- `items[].coverImage.credit`
- `items[].coverImage.verifiedAt`
- `items[].coverImage.status`
- `items[].discussionMetrics.sourceCount`
- `items[].discussionMetrics.platformCount`
- `items[].discussionMetrics.timelineCount`
- `items[].discussionMetrics.latestUpdateAt`
- `items[].discussionMetrics.discussionStage`

Display rules:

- 首页标题使用“公共事件，需要可复核记忆”。
- 不展示公开候选池，Candidate 后续必须先完成隐私预检模型再公开化。
- `资料完整度与更新度` 只展示公开来源数量、平台数量、时间线节点、最近更新、讨论阶段。
- 度量说明固定为“按公开来源数量与更新时间整理，不代表事实判断。”
- 禁止出现热搜、爆了、开冲、站队、男女阵营、胜负、黑红、挂人等动员或阵营化文案。

## CandidateSignals

Source: 暂不公开展示。后续可迁移为后台候选表，但必须先通过隐私预检。

Fields:

- `candidates[].id`
- `candidates[].title`
- `candidates[].community`
- `candidates[].status`
- `candidates[].stage`
- `candidates[].focus`
- `candidates[].coverImage`
- `candidates[].discussionMetrics.sourceCount`
- `candidates[].discussionMetrics.platformCount`
- `candidates[].discussionMetrics.timelineCount`
- `candidates[].discussionMetrics.latestUpdateAt`
- `candidates[].discussionMetrics.discussionStage`

Display rules:

- 高风险候选默认不公开。
- 候选卡只展示抽象议题，不展示可识别当事信息。
- 没有可溯源 `coverImage` 时显示“暂无可核验配图”。

## ArchiveHealth

Source: 事件详情页由详情、来源、平台外链、主张、版本数据派生。

Fields:

- `strongEvidenceCount`
- `weakSourceCount`
- `unresolvedKeyClaimCount`
- `captureCoverage`
- `latestRevisionAt`

Display rules:

- 展示来源等级分布：A 强证据、B 直接材料、C 间接材料、D 弱线索、未定级。
- 公开页区分“已存档”“待存档”“存档失败”，不得把未抓取来源写成已核验。
- 关键主张未决数量只统计 `importance=KEY` 且状态为未核验、证据不足或有争议的主张。

## SessionState

Endpoint:

- `GET /api/session`
- `POST /api/auth/admin-login`
- `POST /api/auth/logout`

Fields:

- `role`: `GUEST | ADMIN`
- `displayName`: 仅管理员会话返回。

Display rules:

- 未登录统一显示“游客浏览”。
- 后台入口仅 `role=ADMIN` 时展示。
- `/admin/login` 页面标题使用“编辑室入口”。

## NeutralSummary

Endpoint: `GET /api/events/:slug`

Fields:

- `summary`
- `tags[].slug`
- `tags[].label`

## CurrentStatus

Endpoint: `GET /api/events/:slug`

Fields:

- `editorialStatus`
- `eventProcessStatus`
- `sourceCount`
- `timelineCount`
- `platformLinkCount`
- `latestUpdates[]`

## OriginalSourceLinks

Endpoint: `GET /api/events/:slug/platform-links`

Title: `原始资料跳转`

Fields:

- `platformLinks[].id`
- `platformLinks[].sourceId`
- `platformLinks[].platform`
- `platformLinks[].contentKind`
- `platformLinks[].title`
- `platformLinks[].description`
- `platformLinks[].authorDisplay`
- `platformLinks[].publishedAt`
- `platformLinks[].availabilityStatus`
- `platformLinks[].originalUrl`
- `platformLinks[].archiveUrl`
- `platformLinks[].thumbnailUrl`
- `platformLinks[].canonicalUrl`
- `platformLinks[].capturedAt`
- `platformLinks[].engagementSnapshot`
- `platformLinks[].displayOrder`

Display rules:

- `platform` 显示为统一平台 badge：B站、小红书、微博、抖音、知乎、其他。
- `contentKind` 显示为类型 badge：视频、笔记、帖子、文章、评论、图片、其他。
- `description` 控制在 80-160 字。后台预检要求不能为空。
- `originalUrl` 新窗口打开，按钮文案为“查看原帖”。
- `archiveUrl` 新窗口打开，按钮文案为“查看存档”；没有存档时显示“存档待生成”。
- 禁止使用“围观”“去冲”等动员性文案。

## Timeline

Endpoint: `GET /api/events/:slug/timeline`

Fields:

- `items[].id`
- `items[].title`
- `items[].body`
- `items[].happenedAt`
- `items[].sourceId`
- `items[].sourceTitle`
- `items[].reliabilityLevel`
- `items[].sortOrder`

## ClaimMatrix

Endpoint: `GET /api/events/:slug/claims`

Fields:

- `items[].id`
- `items[].title`
- `items[].statement`
- `items[].status`
- `items[].importance`
- `items[].claimantActorDisplay`
- `items[].evidenceLinks[].relationType`
- `items[].evidenceLinks[].notes`
- `items[].evidenceLinks[].evidence.id`
- `items[].evidenceLinks[].evidence.title`
- `items[].evidenceLinks[].evidence.reliabilityLevel`

## EvidenceCabinet

Endpoint: `GET /api/events/:slug/claims`

Fields derive from linked evidence:

- `evidence.id`
- `evidence.title`
- `evidence.description`
- `evidence.evidenceKind`
- `evidence.reliabilityLevel`
- `evidence.sourceId`
- `evidence.sourceTitle`
- `evidence.storageUrl`
- `evidence.externalUrl`
- `evidence.capturedAt`

## SourceList

Endpoint: `GET /api/events/:slug/sources`

Fields:

- `items[].id`
- `items[].title`
- `items[].url`
- `items[].sourceType`
- `items[].reliabilityLevel`
- `items[].publisher`
- `items[].authorDisplay`
- `items[].publishedAt`
- `items[].summary`

## WhatWeKnow

Endpoint: `GET /api/events/:slug`

Fields:

- `whatWeKnow[]`

## WhatIsDisputed

Endpoint: `GET /api/events/:slug`

Fields:

- `whatIsDisputed[]`

## WhatNotToInfer

Endpoint: `GET /api/events/:slug`

Fields:

- `whatNotToInfer[]`

## RevisionHistory

Endpoint: `GET /api/events/:slug/versions`

Diff endpoint: `GET /api/events/:slug/versions/:versionId/diff`

Fields:

- `items[].id`
- `items[].versionNumber`
- `items[].changeSummary`
- `items[].createdAt`
- `changedFields[].path`
- `changedFields[].before`
- `changedFields[].after`

## CorrectionCTA

Endpoint: `GET /api/events/:slug`, `POST /api/corrections`

Fields:

- `correctionEnabled`
- `eventId`

## ReportCTA

Endpoint: `GET /api/events/:slug`, `POST /api/reports`

Fields:

- `reportEnabled`
- `eventId`

Report types:

- `PRIVACY_LEAK`
- `DOXXING`
- `DEFAMATION_RISK`
- `MINOR_INFO`
- `HARASSMENT`
- `COPYRIGHT`
- `OTHER`
