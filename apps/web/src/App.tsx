import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Archive,
  BookOpen,
  CheckCircle2,
  Clock3,
  ExternalLink,
  FileSearch,
  Filter,
  Flag,
  History,
  LibraryBig,
  Link2,
  Map as MapIcon,
  Search,
  Shield,
  Sparkles,
  Tags,
  TriangleAlert,
  Moon,
  Sun,
  Database,
  Trash2,
  Check,
  FileText,
  X,
  ChevronRight
} from "lucide-react";
import type {
  ClaimDto,
  EventDetailDto,
  EventListItemDto,
  FailedCheck,
  PlatformLinkDto,
  ReportType,
  RevisionDto,
  SourceDto,
  TimelineEntryDto,
  SessionDto
} from "@memory-archive/shared";
import { getEventProcessStatusLabel, getReliabilityLabel } from "@memory-archive/shared";
import {
  fetchClaims,
  fetchAdminCorrections,
  fetchAdminEvents,
  fetchAdminReports,
  fetchAdminSubmissions,
  fetchAdminTask,
  fetchEventDetail,
  fetchEventPage,
  fetchEvents,
  fetchPlatformLinks,
  fetchSession,
  fetchSources,
  fetchTimeline,
  fetchVersions,
  captureSource,
  createCorrection,
  createReport,
  createSubmission,
  failedChecksFromError,
  isDevMockFallbackEnabled,
  loginAdmin,
  logoutAdmin,
  publishAdminEvent,
  resolveAdminCorrection,
  resolveAdminReport,
  resolveAdminSubmission,
  type AdminCorrectionDto,
  type AdminEventDto,
  type AdminReportDto,
  type AdminSubmissionDto,
  type AdminTaskDto,
  type SubmitReceipt
} from "./api.js";
import { formatDate, getTimeSafe } from "./format-date.js";
import { mockCandidates } from "./mock.js";

// Client-side simple routing
type Route =
  | { name: "home" }
  | { name: "events"; initialTopic?: string }
  | { name: "event"; slug: string }
  | { name: "search" }
  | { name: "topics" }
  | { name: "sources" }
  | { name: "methodology" }
  | { name: "submit" }
  | { name: "correction" }
  | { name: "report" }
  | { name: "admin"; section: string }
  | { name: "admin-login" };

function parseRoute(): Route {
  const path = window.location.pathname.replace(/\/$/, "") || "/";
  const params = new URLSearchParams(window.location.search);
  const topicParam = params.get("topic") || undefined;
  
  if (path === "/") return { name: "home" };
  if (path === "/events") return { name: "events", initialTopic: topicParam };
  if (path.startsWith("/events/")) return { name: "event", slug: decodeURIComponent(path.split("/")[2] ?? "") };
  if (path === "/search") return { name: "search" };
  if (path === "/topics") return { name: "topics" };
  if (path === "/sources") return { name: "sources" };
  if (path === "/methodology") return { name: "methodology" };
  if (path === "/submit") return { name: "submit" };
  if (path === "/corrections") return { name: "correction" };
  if (path === "/reports") return { name: "report" };
  if (path === "/admin/login") return { name: "admin-login" };
  if (path.startsWith("/admin/")) return { name: "admin", section: path.split("/")[2] ?? "events" };
  return { name: "home" };
}

function navigate(path: string) {
  window.history.pushState({}, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

// Data formatters and translators
function processStatusLabel(value: string) {
  return getEventProcessStatusLabel(value);
}

function reliabilityLabel(value?: string | null) {
  return getReliabilityLabel(value);
}

function platformLabel(value: string) {
  const labels: Record<string, string> = {
    BILIBILI: "B站",
    XIAOHONGSHU: "小红书",
    WEIBO: "微博",
    DOUYIN: "抖音",
    ZHIHU: "知乎",
    OTHER: "其他"
  };
  return labels[value] ?? value;
}

function relationLabel(value: string) {
  const labels: Record<string, string> = {
    SUPPORTS: "支持",
    OPPOSES: "相反",
    NEUTRAL: "中性",
    COMPLICATES: "补充复杂性"
  };
  return labels[value] ?? value;
}

function contentKindLabel(value: string) {
  const labels: Record<string, string> = {
    VIDEO: "视频",
    NOTE: "笔记",
    POST: "帖子",
    ARTICLE: "文章",
    COMMENT: "评论",
    IMAGE: "图片",
    OTHER: "其他"
  };
  return labels[value] ?? value;
}

function availabilityLabel(value: string) {
  const labels: Record<string, string> = {
    AVAILABLE: "可访问",
    DELETED: "已删除",
    PRIVATE: "私密",
    LOGIN_REQUIRED: "需登录",
    UNKNOWN: "待检测",
    ARCHIVED_ONLY: "仅存档"
  };
  return labels[value] ?? value;
}

function claimStatusLabel(value: string) {
  const labels: Record<string, string> = {
    UNVERIFIED: "未核实",
    INSUFFICIENT_EVIDENCE: "证据不足",
    DISPUTED: "有争议",
    PARTIALLY_SUPPORTED: "部分证实",
    SUPPORTED: "已证实",
    REFUTED: "已驳回"
  };
  return labels[value] ?? value;
}

function claimImportanceLabel(value: string) {
  const labels: Record<string, string> = {
    KEY: "关键主张",
    CONTEXT: "背景叙事",
    LOW: "次要细节"
  };
  return labels[value] ?? value;
}

function editorialStatusLabel(value: string) {
  const labels: Record<string, string> = {
    DRAFT: "草稿",
    PENDING_REVIEW: "待复核",
    PUBLISHED: "已发布",
    UNPUBLISHED: "已下架",
    ARCHIVED: "已归档"
  };
  return labels[value] ?? value;
}

function reportTypeLabel(value: string) {
  const labels: Record<string, string> = {
    PRIVACY_LEAK: "隐私泄露",
    DOXXING: "人肉曝光",
    DEFAMATION_RISK: "诽谤风险",
    MINOR_INFO: "未成年人信息",
    HARASSMENT: "骚扰风险",
    COPYRIGHT: "版权问题",
    OTHER: "其他"
  };
  return labels[value] ?? value;
}

function queueStatusLabel(value: string) {
  const labels: Record<string, string> = {
    PENDING: "待处理",
    REVIEWED: "已复核",
    ACCEPTED: "已采纳",
    REJECTED: "已驳回",
    TRIAGED: "已分诊",
    RESOLVED: "已处理",
    OPEN: "待审核",
    ACTIVE: "处理中",
    COMPLETED: "已完成",
    FAILED: "失败",
    QUEUED: "排队中"
  };
  return labels[value] ?? value;
}

function preflightLabel(check: FailedCheck) {
  const labels: Record<string, { title: string; action: string; severity: "high" | "medium" }> = {
    NEUTRAL_TITLE_REQUIRED: { title: "缺少中性标题", action: "补齐事件核心信息中的 neutralTitle。", severity: "high" },
    INCITING_TITLE: { title: "标题含动员性措辞", action: "改成事实性、非号召式标题。", severity: "high" },
    SUMMARY_REQUIRED: { title: "缺少摘要", action: "补齐中立摘要，避免结论先行。", severity: "high" },
    SOURCE_REQUIRED: { title: "缺少来源", action: "至少添加一条可复核来源。", severity: "high" },
    TIMELINE_SOURCE_REQUIRED: { title: "时间线未绑定来源", action: "至少为一条时间线节点绑定 sourceId。", severity: "medium" },
    SOURCE_RELIABILITY_REQUIRED: { title: "来源未定级", action: "为来源选择 A/B/C/D 证据等级。", severity: "medium" },
    PLATFORM_LINK_DESCRIPTION_REQUIRED: { title: "平台外链缺少说明", action: "补充 80-160 字中性说明。", severity: "medium" },
    KEY_CLAIM_EVIDENCE_REQUIRED: { title: "关键主张缺少证据", action: "关联证据，或标为未核实/证据不足。", severity: "high" },
    HIGH_PRIVACY_NOTE_REQUIRED: { title: "高隐私对象缺少说明", action: "补充 privacyNote。", severity: "high" },
    MINOR_HIGH_PRIVACY_REQUIRED: { title: "未成年人保护等级不足", action: "调整为 HIGH 或 MINOR_PROTECTED。", severity: "high" },
    SENSITIVE_PERSONAL_INFO: { title: "疑似敏感个人信息", action: "删除或化名处理后再发布。", severity: "high" },
    VERSION_SNAPSHOT_REQUIRED: { title: "缺少版本快照", action: "保存事件版本后再发布。", severity: "medium" },
    CORRECTION_ENTRY_REQUIRED: { title: "纠错入口未开启", action: "开启 correctionEnabled。", severity: "medium" },
    REPORT_ENTRY_REQUIRED: { title: "举报入口未开启", action: "开启 reportEnabled。", severity: "medium" }
  };
  return labels[check.code] ?? { title: check.code, action: "按路径提示修复对应字段。", severity: "medium" as const };
}

// Components
function Header({
  theme,
  toggleTheme,
  session,
  onLogout
}: {
  theme: string;
  toggleTheme: () => void;
  session: SessionDto;
  onLogout: () => void;
}) {
  const currentPath = window.location.pathname;
  const links = [
    ["/events", "事件索引"],
    ["/search", "检索"],
    ["/topics", "议题地图"],
    ["/sources", "资料源"],
    ["/methodology", "方法论"]
  ];
  
  return (
    <header className="site-header">
      <button className="brand" onClick={() => navigate("/")} aria-label="返回首页">
        <LibraryBig size={22} className="brand-icon" />
        <span>公共事件长记忆档案馆</span>
      </button>
      <nav>
        {links.map(([href, label]) => {
          const isActive = currentPath.startsWith(href);
          return (
            <button
              key={href}
              onClick={() => navigate(href)}
              className={isActive ? "active" : ""}
            >
              {label}
            </button>
          );
        })}
      </nav>
      <div className="header-right">
        {session.role === "ADMIN" ? (
          <div className="admin-status-bar" style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginRight: "0.5rem" }}>
            <span className="admin-badge" style={{ fontSize: "0.85rem", color: "var(--primary)", fontWeight: 600 }}>
              编辑室 [{session.displayName}]
            </span>
            <button className="logout-btn-header" onClick={onLogout} style={{ background: "none", border: "1px solid var(--border-color)", borderRadius: "var(--radius-sm)", padding: "0.2rem 0.5rem", fontSize: "0.8rem", cursor: "pointer", color: "var(--text-secondary)" }}>
              退出
            </button>
          </div>
        ) : (
          <span className="visitor-badge" style={{ fontSize: "0.85rem", color: "var(--text-tertiary)", marginRight: "0.5rem" }}>
            游客浏览
          </span>
        )}
        <button
          className="theme-toggle-btn"
          onClick={toggleTheme}
          aria-label={theme === "light" ? "切换至暗色模式" : "切换至亮色模式"}
          title={theme === "light" ? "暗色模式" : "亮色模式"}
        >
          {theme === "light" ? <Moon size={18} /> : <Sun size={18} />}
        </button>
        <button className="header-action" onClick={() => navigate("/submit")}>
          <FileSearch size={16} />
          提交线索
        </button>
      </div>
    </header>
  );
}

function LoadingState() {
  return (
    <div className="state-panel animate-fade">
      <Clock3 />
      <p>档案正在装订中</p>
      <span>请稍候，正在调取档案馆历史卷宗...</span>
    </div>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="state-panel animate-fade">
      <Archive />
      <p>{title}</p>
      <span>{body}</span>
    </div>
  );
}

function ErrorState({ title, body, onRetry }: { title: string; body: string; onRetry?: () => void }) {
  return (
    <div className="state-panel error-panel animate-fade">
      <AlertTriangle />
      <p>{title}</p>
      <span>{body}</span>
      {onRetry && <button onClick={onRetry}>重试</button>}
    </div>
  );
}

function DevFallbackNotice() {
  if (!isDevMockFallbackEnabled()) return null;
  return (
    <div className="dev-fallback-notice">
      开发模式：接口不可用时会回退到演示数据，生产环境会显示错误态。
    </div>
  );
}

function EventCard({ event }: { event: EventListItemDto }) {
  const hasCover = !!event.coverImage?.url;
  return (
    <article className="event-card animate-fade" onClick={() => navigate(`/events/${event.slug}`)}>
      <div className="card-cover-container" style={{ width: "100%", height: "160px", overflow: "hidden", borderBottom: "1px solid var(--border-color)", backgroundColor: "var(--bg-stamp)", position: "relative" }}>
        {hasCover ? (
          <div className="card-cover-wrapper" style={{ width: "100%", height: "100%" }}>
            <img src={event.coverImage!.url} alt={event.coverImage!.alt || event.neutralTitle} className="card-cover-img" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            <div className="card-cover-attribution" style={{ position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: "rgba(0,0,0,0.6)", color: "#ffffff", padding: "0.2rem 0.5rem", fontSize: "0.75rem", display: "flex", justifyContent: "space-between", backdropFilter: "blur(2px)" }}>
              <span>配图：{event.coverImage!.alt || "已核验配图"}</span>
              <span>来源：<a href={event.coverImage!.sourceUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} style={{ color: "var(--primary)", textDecoration: "underline" }}>{event.coverImage!.sourceTitle}</a></span>
            </div>
          </div>
        ) : (
          <div className="card-cover-placeholder" style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-tertiary)", fontSize: "0.9rem" }}>
            <span>暂无可核验配图</span>
          </div>
        )}
      </div>
      <div className="event-card-content" style={{ padding: "1.2rem 0 0 0" }}>
        <div className="card-topline">
          <span className={`tag-badge status-${event.eventProcessStatus.toLowerCase()}`}>
            {processStatusLabel(event.eventProcessStatus)}
          </span>
          <span>更新：{formatDate(event.updatedAt).split(" ")[0]}</span>
        </div>
        <h3 style={{ marginTop: "0.5rem" }}>{event.neutralTitle}</h3>
        <p>{event.summary}</p>
        <div className="tag-row">
          {event.tags.slice(0, 4).map((tag) => (
            <span key={tag.id}>{tag.label}</span>
          ))}
        </div>
        <div className="card-metrics">
          <span>{event.sourceCount} 来源卷宗</span>
          <span>{event.timelineCount} 关键节点</span>
          <span>{event.platformLinkCount} 平台外链</span>
        </div>
      </div>
    </article>
  );
}

// 1. EventHeader
function EventHeader({ event }: { event: EventDetailDto }) {
  const hasCover = !!event.coverImage?.url;
  return (
    <section className="detail-header-wrapper" style={{ display: "flex", flexDirection: "column", gap: "1.5rem", borderBottom: "2px solid var(--text-primary)", paddingBottom: "2.5rem", marginBottom: "3rem" }}>
      <div className="detail-header" style={{ borderBottom: "none", paddingBottom: 0, marginBottom: 0 }}>
        <div>
          <p className="eyebrow">档案卷宗 / {event.topic?.name ?? "公共事件"}</p>
          <h1>{event.neutralTitle}</h1>
          <p>{event.summary}</p>
        </div>
        <aside className="dossier-stamp">
          <span>PUBLIC RECORD</span>
          <strong>{processStatusLabel(event.eventProcessStatus)}</strong>
          <small>更新于 {formatDate(event.updatedAt)}</small>
        </aside>
      </div>
      <div className="detail-cover-container" style={{ width: "100%", maxHeight: "360px", overflow: "hidden", borderRadius: "var(--radius-md)", border: "1px solid var(--border-color)", backgroundColor: "var(--bg-stamp)", position: "relative" }}>
        {hasCover ? (
          <div className="detail-cover-wrapper" style={{ position: "relative", width: "100%", height: "100%" }}>
            <img src={event.coverImage!.url} alt={event.coverImage!.alt || event.neutralTitle} style={{ width: "100%", maxHeight: "360px", objectFit: "cover" }} />
            <div className="detail-cover-attribution" style={{ position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: "rgba(0,0,0,0.6)", color: "#ffffff", padding: "0.4rem 1rem", fontSize: "0.8rem", display: "flex", justifyContent: "space-between", backdropFilter: "blur(2px)" }}>
              <span>配图：{event.coverImage!.alt || "已核验配图"}</span>
              <span>来源：<a href={event.coverImage!.sourceUrl} target="_blank" rel="noopener noreferrer" style={{ color: "var(--primary)", textDecoration: "underline" }}>{event.coverImage!.sourceTitle}</a></span>
            </div>
          </div>
        ) : (
          <div className="detail-cover-placeholder" style={{ height: "180px", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-tertiary)", fontSize: "0.95rem" }}>
            <span>暂无可核验配图</span>
          </div>
        )}
      </div>
    </section>
  );
}

// 2. NeutralSummary
function NeutralSummary({ event }: { event: EventDetailDto }) {
  return (
    <section className="module summary-module animate-fade" id="neutral-summary">
      <div className="module-title">
        <Shield size={20} />
        <h2>中性摘要</h2>
      </div>
      <p>{event.summary}</p>
      <div className="tag-row">
        {event.tags.map((tag) => (
          <span key={tag.id} className="tag-badge">#{tag.label}</span>
        ))}
      </div>
    </section>
  );
}

// 3. CurrentStatus
function CurrentStatus({ event }: { event: EventDetailDto }) {
  return (
    <section className="module status-strip animate-fade" id="current-status">
      <div>
        <span className="label">现实进展阶段</span>
        <strong>{processStatusLabel(event.eventProcessStatus)}</strong>
      </div>
      <div>
        <span className="label">收录资料源</span>
        <strong>{event.sourceCount} 个</strong>
      </div>
      <div>
        <span className="label">梳理时间线节点</span>
        <strong>{event.timelineCount} 个</strong>
      </div>
      <div>
        <span className="label">原始跳转外链</span>
        <strong>{event.platformLinkCount} 条</strong>
      </div>
      {event.latestUpdates && event.latestUpdates.length > 0 && (
        <div className="status-strip-updates">
          {event.latestUpdates.map((update, idx) => (
            <p key={idx}>{update}</p>
          ))}
        </div>
      )}
    </section>
  );
}

function CredibilitySummary({
  event,
  claims,
  sources,
  links,
  versions
}: {
  event: EventDetailDto;
  claims: ClaimDto[];
  sources: SourceDto[];
  links: PlatformLinkDto[];
  versions: RevisionDto[];
}) {
  const strongEvidenceCount = claims.flatMap((claim) => claim.evidenceLinks).filter((link) => link.evidence.reliabilityLevel === "A_STRONG").length;
  const weakSourceCount = sources.filter((source) => source.reliabilityLevel === "D_WEAK" || source.reliabilityLevel === "UNKNOWN").length;
  const openClaimCount = claims.filter((claim) => claim.status === "UNVERIFIED" || claim.status === "INSUFFICIENT_EVIDENCE" || claim.status === "DISPUTED").length;
  const archivedLinkCount = links.filter((link) => !!link.archiveUrl || !!link.capturedAt).length;
  const latestVersion = versions[0];

  return (
    <section className="module credibility-module animate-fade" id="credibility-summary">
      <div className="module-title">
        <Shield size={20} />
        <h2>可信度摘要</h2>
      </div>
      <div className="credibility-grid">
        <div>
          <span>强证据链</span>
          <strong>{strongEvidenceCount}</strong>
        </div>
        <div>
          <span>弱线索/未定级来源</span>
          <strong>{weakSourceCount}</strong>
        </div>
        <div>
          <span>未决主张</span>
          <strong>{openClaimCount}</strong>
        </div>
        <div>
          <span>已存档外链</span>
          <strong>{archivedLinkCount}/{links.length}</strong>
        </div>
      </div>
      <p className="credibility-note">
        当前阶段：{processStatusLabel(event.eventProcessStatus)}。最近版本：
        {latestVersion ? `v${latestVersion.versionNumber}，${formatDate(latestVersion.createdAt)}` : "暂无修订记录"}。
      </p>
    </section>
  );
}

// 4. OriginalSourceLinks (Strict contract check)
function OriginalSourceLinks({ links }: { links: PlatformLinkDto[] }) {
  return (
    <section className="module animate-fade" id="original-source-links">
      <div className="module-title">
        <Link2 size={20} />
        <h2>原始资料跳转</h2>
      </div>
      {links.length === 0 ? (
        <EmptyState title="暂无平台外链" body="来源建档后会显示跳转卡片。" />
      ) : (
        <div className="platform-grid">
          {links.map((link) => {
            // availability status mapping to class
            const availClass = `status-${link.availabilityStatus.toLowerCase()}`;
            
            // Generate visual acronym if image fails
            const letter = link.platform.slice(0, 1);
            
            return (
              <article className="platform-card" key={link.id}>
                {link.thumbnailUrl ? (
                  <img src={link.thumbnailUrl} alt={link.title} loading="lazy" />
                ) : (
                  <div className="thumb-placeholder">
                    {letter}
                  </div>
                )}
                
                <div className="platform-card-body">
                  <div className="badge-row">
                    <span className={`platform-badge platform-${link.platform.toLowerCase()}`}>
                      {platformLabel(link.platform)}
                    </span>
                    <span className="kind-badge">
                      {contentKindLabel(link.contentKind)}
                    </span>
                    <span className={`availability ${availClass}`}>
                      {availabilityLabel(link.availabilityStatus)}
                    </span>
                  </div>
                  
                  <h3>{link.title}</h3>
                  <p>{link.description}</p>
                  
                  <dl>
                    <div>
                      <dt>作者/发布者</dt>
                      <dd title={link.authorDisplay ?? "未标注"}>{link.authorDisplay ?? "未标注"}</dd>
                    </div>
                    <div>
                      <dt>发布时间</dt>
                      <dd>{formatDate(link.publishedAt).split(" ")[0]}</dd>
                    </div>
                  </dl>
                  
                  <div className="card-actions">
                    <a href={link.originalUrl} target="_blank" rel="noopener noreferrer">
                      查看原帖
                      <ExternalLink size={13} />
                    </a>
                    {link.archiveUrl ? (
                      <a href={link.archiveUrl} target="_blank" rel="noopener noreferrer">
                        查看存档
                        <Archive size={13} />
                      </a>
                    ) : (
                      <span className="muted-action">存档待生成</span>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

// 5. Timeline
function Timeline({ timeline }: { timeline: TimelineEntryDto[] }) {
  const sortedTimeline = useMemo(() => {
    return [...timeline].sort((a, b) => a.sortOrder - b.sortOrder);
  }, [timeline]);

  return (
    <section className="module animate-fade" id="timeline">
      <div className="module-title">
        <Clock3 size={20} />
        <h2>时间线</h2>
      </div>
      {sortedTimeline.length === 0 ? (
        <EmptyState title="暂无时间线节点" body="编辑部仍在梳理梳妆该事件的发展轨迹。" />
      ) : (
        <div className="timeline">
          {sortedTimeline.map((entry) => (
            <article key={entry.id} className="timeline-item">
              <time>{formatDate(entry.happenedAt)}</time>
              <div className="timeline-item-content">
                <h3>{entry.title}</h3>
                <p>{entry.body}</p>
                <div className="timeline-metadata">
                  <span>绑定来源：<strong>{entry.sourceTitle ?? "未绑定来源"}</strong></span>
                  {entry.reliabilityLevel && (
                    <span className={`reliability-badge level-${entry.reliabilityLevel.toLowerCase()}`}>
                      {reliabilityLabel(entry.reliabilityLevel)}
                    </span>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

// 6. ClaimMatrix
function ClaimMatrix({ claims }: { claims: ClaimDto[] }) {
  return (
    <section className="module animate-fade" id="claim-matrix">
      <div className="module-title">
        <TriangleAlert size={20} />
        <h2>主张矩阵</h2>
      </div>
      {claims.length === 0 ? (
        <EmptyState title="暂无公开主张" body="尚未解析出多方对立的争议主张。" />
      ) : (
        <div className="claim-list">
          {claims.map((claim) => (
            <article className="claim-card" key={claim.id}>
              <header>
                <span className={`claim-status-badge status-${claim.status.toLowerCase()}`}>
                  {claimStatusLabel(claim.status)}
                </span>
                <span className="claim-importance">
                  {claimImportanceLabel(claim.importance)}
                </span>
              </header>
              <h3>{claim.title}</h3>
              <div className="claim-statement">
                <strong>{claim.claimantActorDisplay ?? "某声索方"} 主张：</strong>
                {claim.statement}
              </div>
              
              {claim.evidenceLinks && claim.evidenceLinks.length > 0 && (
                <div>
                  <div className="evidence-links-title">关联证据链</div>
                  <div className="evidence-links">
                    {claim.evidenceLinks.map((link) => (
                      <div key={link.id} className="relation-item">
                        <span className={`relation-tag relation-${link.relationType.toLowerCase()}`}>
                          {relationLabel(link.relationType)}
                        </span>
                        <div className="relation-desc">
                          <strong>{link.evidence.title}</strong>
                          {link.notes && <span className="relation-notes">{link.notes}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

// 7. EvidenceCabinet
function EvidenceCabinet({ claims }: { claims: ClaimDto[] }) {
  const evidenceList = useMemo(() => {
    const map = new Map<string, ClaimDto["evidenceLinks"][number]["evidence"]>();
    claims.forEach((claim) => {
      claim.evidenceLinks.forEach((link) => {
        if (link.evidence) {
          map.set(link.evidence.id, link.evidence);
        }
      });
    });
    return [...map.values()];
  }, [claims]);

  return (
    <section className="module animate-fade" id="evidence-cabinet">
      <div className="module-title">
        <Archive size={20} />
        <h2>证据柜</h2>
      </div>
      {evidenceList.length === 0 ? (
        <EmptyState title="证据柜为空" body="暂无可展示的实体证据文件目录。" />
      ) : (
        <div className="evidence-cabinet">
          {evidenceList.map((item) => (
            <article key={item.id} className="evidence-folder">
              <div className="evidence-folder-meta">
                <span>FILE-{item.id.toUpperCase()}</span>
                <span className={`reliability-badge level-${item.reliabilityLevel.toLowerCase()}`}>
                  {reliabilityLabel(item.reliabilityLevel)}
                </span>
              </div>
              <h3>{item.title}</h3>
              <p>{item.description}</p>
              <small>绑定卷宗：{item.sourceTitle ?? "未关联外部卷宗"}</small>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

// 8. SourceList
function SourceList({ sources }: { sources: SourceDto[] }) {
  return (
    <section className="module animate-fade" id="source-list">
      <div className="module-title">
        <FileSearch size={20} />
        <h2>来源列表</h2>
      </div>
      {sources.length === 0 ? (
        <EmptyState title="暂无参考资料源" body="档案暂未载入经认证的文献来源。" />
      ) : (
        <div className="source-list">
          {sources.map((source) => (
            <article key={source.id} className="source-item">
              <div className="source-item-body">
                <div className="source-item-top">
                  <span className={`reliability-badge level-${source.reliabilityLevel.toLowerCase()}`}>
                    {reliabilityLabel(source.reliabilityLevel)}
                  </span>
                  <h3>{source.title}</h3>
                </div>
                <p>{source.summary}</p>
                <div className="source-item-meta">
                  <span>发布平台：<strong>{source.publisher ?? "未标注"}</strong></span>
                  <span>作者/发布者：<strong>{source.authorDisplay ?? "未标注"}</strong></span>
                  {source.publishedAt && <span>发布日期：<strong>{formatDate(source.publishedAt).split(" ")[0]}</strong></span>}
                  <span>来源类型：<strong>{source.sourceType}</strong></span>
                </div>
              </div>
              {source.url && (
                <a href={source.url} target="_blank" rel="noopener noreferrer" className="source-open-btn">
                  打开来源
                  <ExternalLink size={12} />
                </a>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

// 9, 10, 11 BulletModule
function BulletModule({
  icon,
  title,
  items,
  type,
  id
}: {
  icon: React.ReactNode;
  title: string;
  items: string[];
  type: "known" | "disputed" | "not-infer";
  id: string;
}) {
  const typeClass = {
    known: "fact-known",
    disputed: "fact-disputed",
    "not-infer": "fact-not-infer"
  }[type];

  return (
    <section className={`module bullet-module ${typeClass} animate-fade`} id={id}>
      <div className="module-title">
        {icon}
        <h2>{title}</h2>
      </div>
      {items.length === 0 ? (
        <p className="no-bullets-text">暂无记录项。</p>
      ) : (
        <ul>
          {items.map((item, idx) => (
            <li key={idx}>{item}</li>
          ))}
        </ul>
      )}
    </section>
  );
}

// 12. RevisionHistory
function RevisionHistory({ versions }: { versions: RevisionDto[] }) {
  return (
    <section className="module animate-fade" id="revision-history">
      <div className="module-title">
        <History size={20} />
        <h2>修订历史</h2>
      </div>
      {versions.length === 0 ? (
        <EmptyState title="暂无修订历史" body="此档案为初始版本，尚未经历结构性修订。" />
      ) : (
        <div className="revision-list">
          {versions.map((version) => (
            <article key={version.id} className="revision-item">
              <span className="version-tag">v{version.versionNumber.toFixed(1)}</span>
              <div className="revision-item-body">
                <p>{version.changeSummary}</p>
                <time>{formatDate(version.createdAt)}</time>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

// 13 & 14. CTASection
function CTASection({ type, eventId }: { type: "correction" | "report"; eventId?: string }) {
  const isCorrection = type === "correction";
  const path = `${isCorrection ? "/corrections" : "/reports"}${eventId ? `?eventId=${encodeURIComponent(eventId)}` : ""}`;
  return (
    <article className={`module cta-module ${isCorrection ? "correction" : "report"}`} id={isCorrection ? "correction-cta" : "report-cta"}>
      <div className="module-title">
        {isCorrection ? <CheckCircle2 size={20} /> : <Flag size={20} />}
        <h2>{isCorrection ? "提出纠错" : "紧急举报"}</h2>
      </div>
      <p>
        {isCorrection
          ? "我们秉持中立客观的态度。若您发现本档案中存在事实性硬伤、失效的来源链接，或不准确的陈述，欢迎提交详实的佐证资料，协助编辑部进行滚动修订。"
          : "若您发现本档案中包含可能泄露个人隐私（如身份证号、手机、住址等）、人肉爆料、诽谤言论或涉及未成年人等高敏感违法内容，请立即通过紧急通道进行申诉。"}
      </p>
      <button onClick={() => navigate(path)}>
        {isCorrection ? "提交事实纠错说明" : "发起紧急删除/撤稿举报"}
      </button>
    </article>
  );
}

// Detail Page Layout Container
function EventDetailPage({ slug }: { slug: string }) {
  const [event, setEvent] = useState<EventDetailDto | null>(null);
  const [links, setLinks] = useState<PlatformLinkDto[]>([]);
  const [timeline, setTimeline] = useState<TimelineEntryDto[]>([]);
  const [claims, setClaims] = useState<ClaimDto[]>([]);
  const [sources, setSources] = useState<SourceDto[]>([]);
  const [versions, setVersions] = useState<RevisionDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    setError("");
    Promise.all([
      fetchEventDetail(slug),
      fetchPlatformLinks(slug),
      fetchTimeline(slug),
      fetchClaims(slug),
      fetchSources(slug),
      fetchVersions(slug)
    ])
      .then(([eventData, linkData, timelineData, claimData, sourceData, versionData]) => {
        setEvent(eventData);
        setLinks(linkData);
        setTimeline(timelineData);
        setClaims(claimData);
        setSources(sourceData);
        setVersions(versionData);
      })
      .catch((err) => {
        console.error("加载卷宗失败", err);
        setError("卷宗接口暂时不可用，生产环境不会回退到演示数据。");
      })
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) return <main className="detail-shell"><LoadingState /></main>;
  if (error) return <main className="detail-shell"><ErrorState title="卷宗加载失败" body={error} onRetry={() => window.location.reload()} /></main>;
  if (!event) return <main className="detail-shell"><EmptyState title="未找到相关档案" body="该卷宗可能尚未建立，或已根据隐私规则被紧急归档撤销。" /></main>;

  return (
    <main className="detail-shell">
      {/* 1. EventHeader */}
      <EventHeader event={event} />
      
      <div className="detail-layout">
        <div className="detail-main">
          <CredibilitySummary event={event} claims={claims} sources={sources} links={links} versions={versions} />

          {/* 2. NeutralSummary */}
          <NeutralSummary event={event} />
          
          {/* 3. CurrentStatus */}
          <CurrentStatus event={event} />
          
          {/* 4. OriginalSourceLinks */}
          <OriginalSourceLinks links={links} />
          
          {/* 5. Timeline */}
          <Timeline timeline={timeline} />
          
          {/* 6. ClaimMatrix */}
          <ClaimMatrix claims={claims} />
          
          {/* 7. EvidenceCabinet */}
          <EvidenceCabinet claims={claims} />
          
          {/* 8. SourceList */}
          <SourceList sources={sources} />
          
          {/* 9. WhatWeKnow */}
          <BulletModule
            id="what-we-know"
            icon={<CheckCircle2 size={20} />}
            title="已知事实"
            items={event.whatWeKnow}
            type="known"
          />
          
          {/* 10. WhatIsDisputed */}
          <BulletModule
            id="what-is-disputed"
            icon={<AlertTriangle size={20} />}
            title="仍有争议"
            items={event.whatIsDisputed}
            type="disputed"
          />
          
          {/* 11. WhatNotToInfer */}
          <BulletModule
            id="what-not-to-infer"
            icon={<Shield size={20} />}
            title="不应推断"
            items={event.whatNotToInfer}
            type="not-infer"
          />
          
          {/* 12. RevisionHistory */}
          <RevisionHistory versions={versions} />
          
          <div className="cta-row">
            {/* 13. CorrectionCTA */}
            <CTASection type="correction" eventId={event.id} />
            {/* 14. ReportCTA */}
            <CTASection type="report" eventId={event.id} />
          </div>
        </div>
        
        {/* Table of Contents sidebar */}
        <aside className="detail-toc">
          <span>卷宗目录结构</span>
          <a href="#credibility-summary">一、 可信度摘要</a>
          <a href="#neutral-summary">二、 中性摘要</a>
          <a href="#current-status">三、 现实进展</a>
          <a href="#original-source-links">四、 原始资料跳转</a>
          <a href="#timeline">五、 事件时间线</a>
          <a href="#claim-matrix">六、 主张分歧矩阵</a>
          <a href="#evidence-cabinet">七、 核心证据柜</a>
          <a href="#source-list">八、 资料源列表</a>
          <a href="#what-we-know">九、 已知事实清单</a>
          <a href="#what-is-disputed">十、 尚存争议细节</a>
          <a href="#what-not-to-infer">十一、 不应推断界限</a>
          <a href="#revision-history">十二、 档案修订日志</a>
          
          <button onClick={() => navigate("/events")}>
            返回事件索引
          </button>
        </aside>
      </div>
    </main>
  );
}

function SimplePage({
  title,
  eyebrow,
  icon,
  children
}: {
  title: string;
  eyebrow: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <main className="page-shell simple-page animate-fade">
      <div className="section-heading">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
        </div>
        <div className="toolbar">
          <div style={{ color: "var(--text-tertiary)", display: "flex", alignItems: "center" }}>
            {icon}
          </div>
        </div>
      </div>
      {children}
    </main>
  );
}

// Interactive Forms
function PublicFeedbackForm({ kind }: { kind: "submit" | "correction" | "report" }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [url, setUrl] = useState("");
  const [email, setEmail] = useState("");
  const [reportType, setReportType] = useState<ReportType>("PRIVACY_LEAK");
  const [submitting, setSubmitting] = useState(false);
  const [receipt, setReceipt] = useState<SubmitReceipt | null>(null);
  const [error, setError] = useState("");

  const copy = {
    submit: ["提交线索", "例如：某平台公开材料、公告页面链接", "线索已受理"],
    correction: ["提交纠错说明", "例如：事实争议描述修正、某失效链接补充", "纠错请求已进入复核"],
    report: ["提交安全举报", "例如：涉及未成年人信息、隐私泄露、人肉风险等", "安全举报已进入复核"]
  }[kind];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !description) {
      alert("请填写关键的标题与说明信息！");
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const eventId = params.get("eventId") || undefined;
    const sourceId = params.get("sourceId") || undefined;
    const platformLinkId = params.get("platformLinkId") || undefined;
    const cleanEmail = email.trim() || undefined;
    const cleanUrl = url.trim() || undefined;

    setSubmitting(true);
    setError("");
    try {
      const urlNote = cleanUrl ? `\n\n补充材料链接：${cleanUrl}` : "";
      const result =
        kind === "submit"
          ? await createSubmission({
              eventId,
              email: cleanEmail,
              title,
              body: description,
              sourceUrl: cleanUrl
            })
          : kind === "correction"
            ? await createCorrection({
                eventId,
                sourceId,
                email: cleanEmail,
                title,
                body: `${description}${urlNote}`
              })
            : await createReport({
                eventId,
                sourceId,
                platformLinkId,
                reportType,
                reporterEmail: cleanEmail,
                body: `${description}${urlNote}`
              });
      setReceipt(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "提交失败，请稍后重试。");
    } finally {
      setSubmitting(false);
    }
  };

  if (receipt) {
    return (
      <div className="form-success-card">
        <CheckCircle2 size={48} />
        <h2>{copy[2]}</h2>
        <p>档案馆已收到反馈，将按照公共事件记录规则进行来源核验、隐私保护预检和人工复核。</p>
        
        <div className="receipt-box">
          <div>
            <span>后端回执 ID：</span>
            <strong>{receipt.id}</strong>
          </div>
          <div>
            <span>反馈类型：</span>
            <strong>{kind.toUpperCase()}</strong>
          </div>
          <div>
            <span>当前状态：</span>
            <strong>{queueStatusLabel(receipt.status)}</strong>
          </div>
          <div>
            <span>接收时间：</span>
            <strong>{formatDate(new Date().toISOString())}</strong>
          </div>
          <div>
            <span>回执单标题：</span>
            <strong>{title}</strong>
          </div>
        </div>

        <button onClick={() => {
          setReceipt(null);
          setTitle("");
          setDescription("");
          setUrl("");
          setEmail("");
          setError("");
        }}>
          继续提交
        </button>
      </div>
    );
  }

  return (
    <form className="archive-form" onSubmit={handleSubmit}>
      <label>
        内容摘要/标题
        <input
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={`请输入简要的${copy[0]}标题`}
        />
      </label>

      <label>
        联系邮箱 (可选)
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="用于后续补充材料，不会公开展示"
        />
      </label>
      
      {kind === "report" && (
        <label>
          举报侵权类型
          <select value={reportType} onChange={(e) => setReportType(e.target.value as ReportType)}>
            <option value="PRIVACY_LEAK">隐私泄露 (PRIVACY_LEAK)</option>
            <option value="DOXXING">人肉曝光 (DOXXING)</option>
            <option value="DEFAMATION_RISK">诽谤风险 (DEFAMATION_RISK)</option>
            <option value="MINOR_INFO">未成年人信息 (MINOR_INFO)</option>
            <option value="HARASSMENT">网暴骚扰 (HARASSMENT)</option>
            <option value="COPYRIGHT">版权纠纷 (COPYRIGHT)</option>
            <option value="OTHER">其他违规项 (OTHER)</option>
          </select>
        </label>
      )}

      <label>
        详细材料描述 / 修订说理论证
        <textarea
          required
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="请说明具体的争议点与佐证细节，确保逻辑严密、不带情绪性修辞"
        />
      </label>

      <label>
        佐证材料链接 (可选)
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://example.com/source-link"
        />
      </label>

      {error && <div className="form-error-box">{error}</div>}

      <button type="submit" disabled={submitting}>
        {submitting ? "材料提交中..." : `递交 ${copy[0]}`}
      </button>
    </form>
  );
}

function AdminPage({ section }: { section: string }) {
  const titles: Record<string, string> = {
    events: "事件发布预检",
    sources: "来源抓取任务",
    "platform-links": "后台平台外链管理",
    review: "线索与纠错队列",
    reports: "后台举报队列"
  };
  const [adminEvents, setAdminEvents] = useState<AdminEventDto[]>([]);
  const [reports, setReports] = useState<AdminReportDto[]>([]);
  const [submissions, setSubmissions] = useState<AdminSubmissionDto[]>([]);
  const [corrections, setCorrections] = useState<AdminCorrectionDto[]>([]);
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminError, setAdminError] = useState("");
  const [adminMessage, setAdminMessage] = useState("");
  const [publishingId, setPublishingId] = useState("");
  const [failedChecks, setFailedChecks] = useState<Record<string, FailedCheck[]>>({});
  const [reportNotes, setReportNotes] = useState<Record<string, string>>({});
  const [sourceIdInput, setSourceIdInput] = useState("");
  const [captureResult, setCaptureResult] = useState<{ taskId: string; queued: boolean } | null>(null);
  const [taskLookupId, setTaskLookupId] = useState("");
  const [taskDetail, setTaskDetail] = useState<AdminTaskDto | null>(null);

  const loadAdminData = async () => {
    setAdminLoading(true);
    setAdminError("");
    setAdminMessage("");
    try {
      if (section === "events") {
        const data = await fetchAdminEvents({ pageSize: 50 });
        setAdminEvents(data.items);
      } else if (section === "reports") {
        setReports(await fetchAdminReports());
      } else if (section === "review") {
        const [submissionData, correctionData] = await Promise.all([
          fetchAdminSubmissions(),
          fetchAdminCorrections()
        ]);
        setSubmissions(submissionData);
        setCorrections(correctionData);
      }
    } catch (err) {
      setAdminError(err instanceof Error ? err.message : "后台数据加载失败");
    } finally {
      setAdminLoading(false);
    }
  };

  useEffect(() => {
    void loadAdminData();
  }, [section]);

  const handlePublish = async (event: AdminEventDto) => {
    setPublishingId(event.id);
    setAdminError("");
    setAdminMessage("");
    setFailedChecks((prev) => ({ ...prev, [event.id]: [] }));
    try {
      await publishAdminEvent(event.id);
      setAdminMessage(`「${event.neutralTitle}」已发布。`);
      await loadAdminData();
    } catch (err) {
      const checks = failedChecksFromError(err);
      if (checks.length > 0) {
        setFailedChecks((prev) => ({ ...prev, [event.id]: checks }));
        setAdminError("发布预检未通过，请按下列项目修复。");
      } else {
        setAdminError(err instanceof Error ? err.message : "发布失败");
      }
    } finally {
      setPublishingId("");
    }
  };

  const handleReportAction = async (report: AdminReportDto, status: "TRIAGED" | "RESOLVED" | "REJECTED") => {
    const note = reportNotes[report.id]?.trim() || (status === "TRIAGED" ? "已完成初步分诊。" : status === "RESOLVED" ? "已处理完成。" : "经复核暂不采纳。");
    setAdminError("");
    try {
      await resolveAdminReport(report.id, status, note);
      setAdminMessage(`举报 ${report.id} 已更新为 ${queueStatusLabel(status)}。`);
      await loadAdminData();
    } catch (err) {
      setAdminError(err instanceof Error ? err.message : "举报处理失败");
    }
  };

  const handleSubmissionAction = async (item: AdminSubmissionDto, status: "REVIEWED" | "ACCEPTED" | "REJECTED") => {
    setAdminError("");
    try {
      await resolveAdminSubmission(item.id, status);
      setAdminMessage(`线索 ${item.id} 已更新为 ${queueStatusLabel(status)}。`);
      await loadAdminData();
    } catch (err) {
      setAdminError(err instanceof Error ? err.message : "线索处理失败");
    }
  };

  const handleCorrectionAction = async (item: AdminCorrectionDto, status: "ACCEPTED" | "REJECTED" | "RESOLVED") => {
    setAdminError("");
    try {
      await resolveAdminCorrection(item.id, status);
      setAdminMessage(`纠错 ${item.id} 已更新为 ${queueStatusLabel(status)}。`);
      await loadAdminData();
    } catch (err) {
      setAdminError(err instanceof Error ? err.message : "纠错处理失败");
    }
  };

  const handleCapture = async () => {
    const sourceId = sourceIdInput.trim();
    if (!sourceId) {
      setAdminError("请先填写 sourceId。");
      return;
    }
    setAdminError("");
    try {
      const result = await captureSource(sourceId);
      setCaptureResult(result);
      setTaskLookupId(result.taskId);
      setAdminMessage(result.queued ? "抓取任务已进入队列。" : "任务已创建，但 Redis 队列未启用。");
    } catch (err) {
      setAdminError(err instanceof Error ? err.message : "抓取任务创建失败");
    }
  };

  const handleTaskLookup = async () => {
    const taskId = taskLookupId.trim();
    if (!taskId) {
      setAdminError("请先填写 taskId。");
      return;
    }
    setAdminError("");
    try {
      setTaskDetail(await fetchAdminTask(taskId));
    } catch (err) {
      setAdminError(err instanceof Error ? err.message : "任务查询失败");
    }
  };

  return (
    <SimplePage title={titles[section] ?? "后台管理台"} eyebrow="Editorial Control Center" icon={<Database />}>
      <div className="admin-grid">
        {["events", "sources", "platform-links", "review", "reports"].map((item) => (
          <button
            key={item}
            onClick={() => navigate(`/admin/${item}`)}
            className={item === section ? "active" : ""}
          >
            {titles[item]}
          </button>
        ))}
      </div>
      
      <div className="admin-panel animate-fade">
        <h2>{titles[section] ?? "管理面板"}</h2>
        <p className="admin-subtitle">
          后台操作会写入真实接口。AI 辅助仍保持 suggestions-only，不会自动发布或写库。
        </p>
        {adminError && <div className="admin-alert error"><AlertTriangle size={16} />{adminError}</div>}
        {adminMessage && <div className="admin-alert success"><CheckCircle2 size={16} />{adminMessage}</div>}
        {adminLoading && <LoadingState />}

        {!adminLoading && section === "events" && (
          <div className="admin-list">
            <h3>事件发布预检 ({adminEvents.length})</h3>
            {adminEvents.length === 0 ? (
              <EmptyState title="暂无事件" body="后台未读取到事件草稿或公开档案。" />
            ) : (
              adminEvents.map((event) => (
                <div className="admin-list-item admin-list-item-column" key={event.id}>
                  <div className="admin-item-info">
                    <span className="admin-item-meta">
                      EVENT_ID: {event.id} | {editorialStatusLabel(event.editorialStatus)} | {processStatusLabel(event.eventProcessStatus)}
                    </span>
                    <strong className="admin-item-title">{event.neutralTitle}</strong>
                    <span className="admin-item-desc">{event.summary}</span>
                    <span className="admin-item-meta">
                      来源 {event.sourceCount} / 时间线 {event.timelineCount} / 平台外链 {event.platformLinkCount}
                    </span>
                  </div>
                  <div className="admin-item-actions">
                    <button onClick={() => navigate(`/events/${event.slug}`)}>
                      <ExternalLink size={14} /> 查看公开页
                    </button>
                    <button className="btn-success" onClick={() => handlePublish(event)} disabled={publishingId === event.id}>
                      <Check size={14} /> {publishingId === event.id ? "预检中" : "运行预检并发布"}
                    </button>
                  </div>
                  {(failedChecks[event.id] ?? []).length > 0 && (
                    <div className="preflight-list">
                      {(failedChecks[event.id] ?? []).map((check) => {
                        const meta = preflightLabel(check);
                        return (
                          <div className={`preflight-item severity-${meta.severity}`} key={`${check.code}-${check.path ?? ""}`}>
                            <strong>{meta.title}</strong>
                            <span>{check.message}</span>
                            <small>路径：{check.path ?? "未指定"} | 修复：{meta.action}</small>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {!adminLoading && section === "sources" && (
          <div className="admin-tool-stack">
            <div className="admin-tool-card">
              <h3>创建来源抓取任务</h3>
              <label>
                Source ID
                <input value={sourceIdInput} onChange={(e) => setSourceIdInput(e.target.value)} placeholder="src_xxxxx" />
              </label>
              <button onClick={handleCapture}><Archive size={14} /> 触发抓取</button>
              {captureResult && (
                <p className="admin-inline-result">
                  taskId: <strong>{captureResult.taskId}</strong>，队列状态：{captureResult.queued ? "已入队" : "未入队"}
                </p>
              )}
            </div>
            <div className="admin-tool-card">
              <h3>查询抓取任务</h3>
              <label>
                Task ID
                <input value={taskLookupId} onChange={(e) => setTaskLookupId(e.target.value)} placeholder="task_xxxxx" />
              </label>
              <button onClick={handleTaskLookup}><Search size={14} /> 查询任务</button>
              {taskDetail && (
                <div className="task-detail">
                  <span>{taskDetail.type} / {queueStatusLabel(taskDetail.status)} / {taskDetail.progress}%</span>
                  {taskDetail.errorMessage && <span>错误：{taskDetail.errorMessage}</span>}
                  {(taskDetail.captures ?? []).map((capture) => (
                    <small key={capture.id}>
                      {capture.captureStatus} | {capture.originalUrl} | hash: {capture.contentHash ?? "未生成"}
                    </small>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {!adminLoading && section === "review" && (
          <div className="admin-list">
            <h3>线索队列 ({submissions.filter((item) => item.status === "PENDING").length})</h3>
            {submissions.map((item) => (
              <div className="admin-list-item" key={item.id}>
                <div className="admin-item-info">
                  <span className="admin-item-meta">SUBMISSION_ID: {item.id} | {queueStatusLabel(item.status)}</span>
                  <strong className="admin-item-title">{item.title}</strong>
                  <span className="admin-item-desc">{item.body}</span>
                  {item.sourceUrl && <span className="admin-item-meta">来源链接：{item.sourceUrl}</span>}
                </div>
                <div className="admin-item-actions">
                  <button onClick={() => handleSubmissionAction(item, "REVIEWED")}><Check size={14} /> 已复核</button>
                  <button className="btn-success" onClick={() => handleSubmissionAction(item, "ACCEPTED")}><Check size={14} /> 采纳</button>
                  <button className="btn-danger" onClick={() => handleSubmissionAction(item, "REJECTED")}><X size={14} /> 驳回</button>
                </div>
              </div>
            ))}
            <h3>纠错队列 ({corrections.filter((item) => item.status === "PENDING").length})</h3>
            {corrections.map((item) => (
              <div className="admin-list-item" key={item.id}>
                <div className="admin-item-info">
                  <span className="admin-item-meta">CORRECTION_ID: {item.id} | {queueStatusLabel(item.status)}</span>
                  <strong className="admin-item-title">{item.title}</strong>
                  <span className="admin-item-desc">{item.body}</span>
                  <span className="admin-item-meta">
                    事件：{item.event?.neutralTitle ?? "未绑定"} | 来源：{item.source?.title ?? "未绑定"}
                  </span>
                </div>
                <div className="admin-item-actions">
                  <button className="btn-success" onClick={() => handleCorrectionAction(item, "ACCEPTED")}><Check size={14} /> 采纳并快照</button>
                  <button onClick={() => handleCorrectionAction(item, "RESOLVED")}><Check size={14} /> 标记已处理</button>
                  <button className="btn-danger" onClick={() => handleCorrectionAction(item, "REJECTED")}><X size={14} /> 驳回</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {!adminLoading && section === "reports" && (
          <div className="admin-list">
            <h3>举报队列 ({reports.filter((item) => item.status === "PENDING").length})</h3>
            {reports.length === 0 ? (
              <EmptyState title="暂无举报" body="当前没有待处理安全举报。" />
            ) : (
              reports.map((report) => (
                <div className="admin-list-item admin-list-item-column" key={report.id}>
                  <div className="admin-item-info">
                    <span className="admin-item-meta">
                      REPORT_ID: {report.id} | {reportTypeLabel(report.reportType)} | {queueStatusLabel(report.status)} | priority {report.priority}
                    </span>
                    <strong className="admin-item-title">{report.event?.neutralTitle ?? report.platformLink?.title ?? report.source?.title ?? "未绑定对象"}</strong>
                    <span className="admin-item-desc">{report.body}</span>
                    {report.resolutionNotes && <span className="admin-item-meta">处理记录：{report.resolutionNotes}</span>}
                  </div>
                  <label className="admin-note-input">
                    处理说明
                    <textarea
                      value={reportNotes[report.id] ?? ""}
                      onChange={(e) => setReportNotes((prev) => ({ ...prev, [report.id]: e.target.value }))}
                      placeholder="填写内部处理说明"
                    />
                  </label>
                  <div className="admin-item-actions">
                    <button onClick={() => handleReportAction(report, "TRIAGED")}><Flag size={14} /> 标记分诊</button>
                    <button className="btn-success" onClick={() => handleReportAction(report, "RESOLVED")}><Check size={14} /> 处理完成</button>
                    <button className="btn-danger" onClick={() => handleReportAction(report, "REJECTED")}><X size={14} /> 驳回</button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {!adminLoading && section === "platform-links" && (
          <div className="state-panel" style={{ borderStyle: "solid", padding: "3rem" }}>
            <Link2 />
            <p>平台外链仍由事件来源页写入</p>
            <span>当前最小闭环优先支持真实举报、发布预检和来源抓取；平台外链新增仍使用 `/admin/events/:id/platform-links` 接口联调。</span>
          </div>
        )}
      </div>
    </SimplePage>
  );
}

function AdminLoginPage({ onLoginSuccess }: { onLoginSuccess: (session: SessionDto) => void }) {
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passcode) return;
    setError("");
    setLoading(true);
    try {
      const session = await loginAdmin(passcode);
      onLoginSuccess(session);
      navigate("/admin/events");
    } catch (err: any) {
      setError(err.message || "密码错误或系统未配置");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SimplePage title="编辑室入口" eyebrow="Editorial Entrance" icon={<Shield size={22} />}>
      <div className="login-panel-container" style={{ margin: "2rem auto", maxWidth: "450px" }}>
        <form className="archive-form" onSubmit={handleSubmit}>
          <label>
            请输入管理密码 (ADMIN_PASSCODE)
            <input
              type="password"
              required
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
              placeholder="请输入访问凭证..."
              disabled={loading}
              style={{ width: "100%", padding: "0.6rem", fontSize: "1rem", marginTop: "0.5rem" }}
            />
          </label>
          {error && <div className="error-message-box" style={{ color: "var(--accent-crimson)", fontSize: "0.85rem", marginTop: "0.5rem" }}>{error}</div>}
          <button type="submit" disabled={loading} style={{ marginTop: "1rem" }}>
            {loading ? "验证凭证中..." : "进入编辑工作台"}
          </button>
        </form>
      </div>
    </SimplePage>
  );
}

// Main App Component
export function App() {
  const [route, setRoute] = useState<Route>(parseRoute());
  const [theme, setTheme] = useState<string>(() => {
    return localStorage.getItem("theme") || "light";
  });
  const [session, setSession] = useState<SessionDto>({ role: "GUEST" });
  const [sessionLoaded, setSessionLoaded] = useState(false);

  // Handle Theme effect
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === "light" ? "dark" : "light"));
  };

  // Simple popstate history tracking
  useEffect(() => {
    const handler = () => setRoute(parseRoute());
    window.addEventListener("popstate", handler);
    return () => window.removeEventListener("popstate", handler);
  }, []);

  // Fetch session status on mount
  useEffect(() => {
    fetchSession()
      .then(setSession)
      .catch(() => setSession({ role: "GUEST" }))
      .finally(() => setSessionLoaded(true));
  }, []);

  useEffect(() => {
    if (sessionLoaded && route.name === "admin" && session.role !== "ADMIN") {
      navigate("/admin/login");
    }
  }, [route, session, sessionLoaded]);

  const handleLogout = async () => {
    try {
      await logoutAdmin();
      setSession({ role: "GUEST" });
      navigate("/");
    } catch (err) {
      console.error("Logout failed:", err);
    }
  };

  // Events list fetching state
  const [events, setEvents] = useState<EventListItemDto[]>([]);
  const [eventResults, setEventResults] = useState<EventListItemDto[]>([]);
  const [eventTotal, setEventTotal] = useState(0);
  const [eventPage, setEventPage] = useState(1);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [eventListError, setEventListError] = useState("");

  // Filters for Events Index
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTopic, setSelectedTopic] = useState<string>("");
  const [selectedStatus, setSelectedStatus] = useState<string>("");
  const [selectedPlatform, setSelectedPlatform] = useState<string>("");
  const [selectedSort, setSelectedSort] = useState<"updated" | "newest" | "oldest" | "sourceCount">("updated");

  useEffect(() => {
    setLoadingEvents(true);
    fetchEvents()
      .then((items) => {
        setEvents(items);
        setEventResults(items);
        setEventTotal(items.length);
      })
      .catch((err) => setEventListError(err instanceof Error ? err.message : "事件列表加载失败"))
      .finally(() => setLoadingEvents(false));
  }, []);

  // Set pre-filtered topic from route queries if navigated from Topic Map
  useEffect(() => {
    if (route.name === "events" && route.initialTopic) {
      setSelectedTopic(route.initialTopic);
    }
  }, [route]);

  useEffect(() => {
    setEventPage(1);
  }, [searchQuery, selectedTopic, selectedStatus, selectedPlatform, selectedSort]);

  useEffect(() => {
    if (route.name !== "events" && route.name !== "search") return;
    setLoadingEvents(true);
    setEventListError("");
    fetchEventPage({
      page: eventPage,
      pageSize: 12,
      query: searchQuery.trim() || undefined,
      topic: selectedTopic || undefined,
      eventProcessStatus: (selectedStatus as any) || undefined,
      platform: (selectedPlatform as any) || undefined,
      sort: selectedSort
    })
      .then((data) => {
        setEventResults(data.items);
        setEventTotal(data.total);
      })
      .catch((err) => setEventListError(err instanceof Error ? err.message : "事件列表加载失败"))
      .finally(() => setLoadingEvents(false));
  }, [route.name, eventPage, searchQuery, selectedTopic, selectedStatus, selectedPlatform, selectedSort]);

  let pageContent: React.ReactNode;

  if (route.name === "home") {
    // Sort events for source completeness by sourceCount descending, then updatedAt descending
    const rankedEvents = [...events].sort((a, b) => {
      const aCount = a.discussionMetrics?.sourceCount ?? a.sourceCount;
      const bCount = b.discussionMetrics?.sourceCount ?? b.sourceCount;
      if (bCount !== aCount) return bCount - aCount;
      return getTimeSafe(b.updatedAt) - getTimeSafe(a.updatedAt);
    });

    pageContent = (
      <main className="animate-fade">
        <DevFallbackNotice />
        <section className="hero">
          <div className="hero-copy">
            <p className="eyebrow">Public Record & Fact Archive / 公共事件长记忆档案馆</p>
            <h1>公共事件，<br />需要可复核记忆</h1>
            <p>
              本馆面向公开公共争议事件进行长期事实存照，提供克制、中立、高信息密度的资料索引，区分事实、说法、证据与争议，保留可复核的传播过程。
            </p>
            <div className="hero-actions">
              <button onClick={() => navigate("/events")}>
                <Archive size={18} />
                查阅档案索引
              </button>
              <button className="ghost" onClick={() => navigate("/methodology")}>
                <BookOpen size={18} />
                查阅方法论说明
              </button>
            </div>
          </div>
          
          <div className="hero-stats">
            <div className="hero-stat-item">
               <strong>{events.length || "2"} 卷</strong>
               <span>在册争议事件</span>
            </div>
            <div className="hero-stat-item">
              <strong>{events.reduce((sum, e) => sum + e.sourceCount, 0) || "8"} 份</strong>
              <span>认证原始材料</span>
            </div>
            <div className="hero-stat-item">
              <strong>{events.reduce((sum, e) => sum + e.platformLinkCount, 0) || "6"} 条</strong>
              <span>存卷跳转外链</span>
            </div>
          </div>
        </section>

        {/* 待核验线索池 */}
        <section className="candidates-band" style={{ padding: "4rem 2rem", borderBottom: "1px solid var(--border-color)" }}>
          <div className="section-heading">
            <div>
              <p className="eyebrow">Pending Signals / 待建档库</p>
              <h2>待核验线索池</h2>
            </div>
          </div>
          <div className="candidates-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "1.5rem" }}>
            {mockCandidates.map((candidate) => (
              <article key={candidate.id} className="candidate-card" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)", padding: "1.5rem", borderRadius: "var(--radius-sm)" }}>
                <div className="candidate-cover" style={{ height: "120px", margin: "-1.5rem -1.5rem 1.25rem", borderBottom: "1px solid var(--border-color)", backgroundColor: "var(--bg-stamp)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-tertiary)", fontSize: "0.9rem", position: "relative", overflow: "hidden" }}>
                  {candidate.coverImage?.url ? (
                    <>
                      <img src={candidate.coverImage.url} alt={candidate.coverImage.alt} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      <div className="candidate-cover-source" style={{ position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: "rgba(0,0,0,0.62)", color: "#fff", padding: "0.25rem 0.6rem", fontSize: "0.72rem" }}>
                        来源：<a href={candidate.coverImage.sourceUrl} target="_blank" rel="noopener noreferrer" style={{ color: "#fff", textDecoration: "underline" }}>{candidate.coverImage.sourceTitle}</a>
                      </div>
                    </>
                  ) : (
                    <span>暂无可核验配图</span>
                  )}
                </div>
                <div className="candidate-topline" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                  <span className="candidate-badge status-pending" style={{ backgroundColor: "var(--bg-stamp)", color: "var(--accent-yellow)", fontSize: "0.75rem", padding: "0.2rem 0.5rem", borderRadius: "2px", fontWeight: 600 }}>
                    {candidate.status}
                  </span>
                  <span className="candidate-community" style={{ fontSize: "0.8rem", color: "var(--text-tertiary)" }}>
                    {candidate.community}
                  </span>
                </div>
                <h3 style={{ fontSize: "1.1rem", fontFamily: "var(--font-serif)", fontWeight: 700, marginBottom: "0.8rem", color: "var(--text-primary)" }}>{candidate.title}</h3>
                <div className="candidate-details" style={{ fontSize: "0.85rem", color: "var(--text-secondary)", display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                  <p><strong>当前阶段：</strong>{candidate.stage}</p>
                  <p><strong>核心关注：</strong>{candidate.focus}</p>
                  <p><strong>度量：</strong>{candidate.discussionMetrics.sourceCount} 来源 / {candidate.discussionMetrics.platformCount} 平台</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* 资料完整度与更新度 */}
        <section className="ranking-band" style={{ padding: "4rem 2rem", borderBottom: "1px solid var(--border-color)" }}>
          <div className="section-heading" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: "1rem" }}>
            <div>
              <p className="eyebrow">Source Completeness / 统计度量</p>
              <h2>资料完整度与更新度</h2>
            </div>
            <span className="ranking-disclaimer" style={{ fontSize: "0.85rem", color: "var(--accent-crimson)", fontWeight: 500 }}>
              按公开来源数量与更新时间整理，不代表事实判断。
            </span>
          </div>
          <div className="ranking-list" style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {rankedEvents.map((event, index) => {
              const metrics = event.discussionMetrics ?? {
                sourceCount: event.sourceCount,
                platformCount: event.platformLinkCount,
                timelineCount: event.timelineCount,
                latestUpdateAt: event.updatedAt,
                discussionStage: processStatusLabel(event.eventProcessStatus)
              };
              return (
                <div key={event.id} className="ranking-item" style={{ display: "flex", backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: "var(--radius-sm)", overflow: "hidden" }}>
                  <div className="ranking-rank" style={{ width: "60px", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "var(--bg-stamp)", color: "var(--text-primary)", fontSize: "1.5rem", fontFamily: "var(--font-mono)", fontWeight: 700, borderRight: "1px solid var(--border-color)" }}>
                    {index + 1}
                  </div>
                  <div className="ranking-cover" style={{ width: "132px", minHeight: "132px", borderRight: "1px solid var(--border-color)", backgroundColor: "var(--bg-stamp)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-tertiary)", fontSize: "0.8rem", textAlign: "center", padding: "0.8rem", position: "relative", overflow: "hidden" }}>
                    {event.coverImage?.url ? (
                      <>
                        <img src={event.coverImage.url} alt={event.coverImage.alt || event.neutralTitle} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
                        <span style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "0.2rem 0.4rem", backgroundColor: "rgba(0,0,0,0.62)", color: "#fff", fontSize: "0.68rem" }}>来源：{event.coverImage.sourceTitle}</span>
                      </>
                    ) : (
                      <span>暂无可核验配图</span>
                    )}
                  </div>
                  <div className="ranking-main" style={{ flex: 1, padding: "1.2rem 1.5rem" }}>
                    <h3 className="ranking-title" onClick={() => navigate(`/events/${event.slug}`)} style={{ fontSize: "1.15rem", fontFamily: "var(--font-serif)", fontWeight: 700, cursor: "pointer", color: "var(--text-primary)", marginBottom: "0.8rem" }}>
                      {event.neutralTitle}
                    </h3>
                    <div className="ranking-metrics-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: "1rem" }}>
                      <div className="ranking-metric">
                        <span className="metric-label" style={{ display: "block", fontSize: "0.75rem", color: "var(--text-tertiary)" }}>公开来源数</span>
                        <strong className="metric-val" style={{ display: "block", fontSize: "1.1rem", color: "var(--text-primary)" }}>{metrics.sourceCount}</strong>
                      </div>
                      <div className="ranking-metric">
                        <span className="metric-label" style={{ display: "block", fontSize: "0.75rem", color: "var(--text-tertiary)" }}>覆盖平台数</span>
                        <strong className="metric-val" style={{ display: "block", fontSize: "1.1rem", color: "var(--text-primary)" }}>{metrics.platformCount}</strong>
                      </div>
                      <div className="ranking-metric">
                        <span className="metric-label" style={{ display: "block", fontSize: "0.75rem", color: "var(--text-tertiary)" }}>时间线节点</span>
                        <strong className="metric-val" style={{ display: "block", fontSize: "1.1rem", color: "var(--text-primary)" }}>{metrics.timelineCount}</strong>
                      </div>
                      <div className="ranking-metric">
                        <span className="metric-label" style={{ display: "block", fontSize: "0.75rem", color: "var(--text-tertiary)" }}>讨论阶段</span>
                        <strong className="metric-val text-stage" style={{ display: "block", fontSize: "1rem", color: "var(--primary)" }}>{metrics.discussionStage}</strong>
                      </div>
                      <div className="ranking-metric" style={{ gridColumn: "span 2" }}>
                        <span className="metric-label" style={{ display: "block", fontSize: "0.75rem", color: "var(--text-tertiary)" }}>最近更新</span>
                        <strong className="metric-val" style={{ display: "block", fontSize: "0.95rem", color: "var(--text-secondary)", fontFamily: "var(--font-mono)" }}>{formatDate(metrics.latestUpdateAt)}</strong>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* 最新录入档案 */}
        <section className="index-band">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Recently Filed / 档案索引</p>
              <h2>最新录入档案</h2>
            </div>
            <button className="text-action" onClick={() => navigate("/events")}>
              浏览全部档案 <ChevronRight size={16} />
            </button>
          </div>
          
          {loadingEvents ? (
            <LoadingState />
          ) : events.length === 0 ? (
            <EmptyState title="暂无在册档案" body="档案馆尚未发布任何公开卷宗。" />
          ) : (
            <div className="event-grid">
              {events.slice(0, 3).map((event) => (
                <EventCard key={event.id} event={event} />
              ))}
            </div>
          )}
        </section>
      </main>
    );
  }

  if (route.name === "events") {
    const uniqueTopics = Array.from(
      new Set(events.map((e) => e.topic).filter(Boolean))
    ) as { slug: string; name: string }[];

    pageContent = (
      <main className="page-shell">
        <DevFallbackNotice />
        <div className="section-heading">
          <div>
            <p className="eyebrow">Dossier Indexes / 卷宗索引</p>
            <h1>在册档案索引</h1>
          </div>
          
          <div className="toolbar">
            {/* Search query input */}
            <div className="filter-search-bar">
              <Search size={14} style={{ color: "var(--text-tertiary)" }} />
              <input
                type="text"
                placeholder="搜索标题或内容..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button
                  style={{ background: "none", border: "none", cursor: "pointer", display: "flex" }}
                  onClick={() => setSearchQuery("")}
                >
                  <X size={14} style={{ color: "var(--text-tertiary)" }} />
                </button>
              )}
            </div>

            {/* Topic Filter */}
            <select
              value={selectedTopic}
              onChange={(e) => setSelectedTopic(e.target.value)}
              style={{
                backgroundColor: "var(--bg-card)",
                border: "1px solid var(--border-color)",
                color: "var(--text-secondary)",
                borderRadius: "var(--radius-sm)",
                padding: "0.2rem 0.5rem",
                fontSize: "0.9rem",
                outline: "none"
              }}
            >
              <option value="">全部议题</option>
              {uniqueTopics.map((topic) => (
                <option key={topic.slug} value={topic.slug}>
                  {topic.name}
                </option>
              ))}
            </select>

            {/* Status Filter */}
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              style={{
                backgroundColor: "var(--bg-card)",
                border: "1px solid var(--border-color)",
                color: "var(--text-secondary)",
                borderRadius: "var(--radius-sm)",
                padding: "0.2rem 0.5rem",
                fontSize: "0.9rem",
                outline: "none"
              }}
            >
              <option value="">全部进展状态</option>
              <option value="UNVERIFIED">材料收集中</option>
              <option value="DEVELOPING">讨论扩散中</option>
              <option value="PLATFORM_INTERVENED">平台回应后</option>
              <option value="OFFICIAL_INVESTIGATION">机构核验中</option>
              <option value="LEGAL_PROCESS">程序推进中</option>
              <option value="CONCLUDED">阶段性收束</option>
            </select>

            <select
              value={selectedPlatform}
              onChange={(e) => setSelectedPlatform(e.target.value)}
              style={{
                backgroundColor: "var(--bg-card)",
                border: "1px solid var(--border-color)",
                color: "var(--text-secondary)",
                borderRadius: "var(--radius-sm)",
                padding: "0.2rem 0.5rem",
                fontSize: "0.9rem",
                outline: "none"
              }}
            >
              <option value="">全部平台</option>
              <option value="BILIBILI">B站</option>
              <option value="XIAOHONGSHU">小红书</option>
              <option value="WEIBO">微博</option>
              <option value="DOUYIN">抖音</option>
              <option value="ZHIHU">知乎</option>
              <option value="OTHER">其他</option>
            </select>

            <select
              value={selectedSort}
              onChange={(e) => setSelectedSort(e.target.value as typeof selectedSort)}
              style={{
                backgroundColor: "var(--bg-card)",
                border: "1px solid var(--border-color)",
                color: "var(--text-secondary)",
                borderRadius: "var(--radius-sm)",
                padding: "0.2rem 0.5rem",
                fontSize: "0.9rem",
                outline: "none"
              }}
            >
              <option value="updated">最近更新</option>
              <option value="newest">发生时间较新</option>
              <option value="oldest">发生时间较早</option>
              <option value="sourceCount">来源数量</option>
            </select>
          </div>
        </div>

        {eventListError ? (
          <ErrorState title="档案索引加载失败" body={eventListError} onRetry={() => window.location.reload()} />
        ) : loadingEvents ? (
          <LoadingState />
        ) : eventResults.length === 0 ? (
          <EmptyState
            title="未检索到匹配的档案"
            body="建议尝试清除筛选条件，或使用不同的搜索词再次检索。"
          />
        ) : (
          <>
            <div className="result-count">共匹配 {eventTotal} 个公开档案</div>
            <div className="event-grid">
              {eventResults.map((event) => (
                <EventCard key={event.id} event={event} />
              ))}
            </div>
            <div className="pagination-row">
              <button disabled={eventPage <= 1} onClick={() => setEventPage((page) => Math.max(1, page - 1))}>上一页</button>
              <span>第 {eventPage} 页</span>
              <button disabled={eventPage * 12 >= eventTotal} onClick={() => setEventPage((page) => page + 1)}>下一页</button>
            </div>
          </>
        )}
      </main>
    );
  }

  if (route.name === "event") {
    pageContent = <EventDetailPage slug={route.slug} />;
  }

  if (route.name === "search") {
    pageContent = (
      <SimplePage title="全文卷宗检索" eyebrow="Search Database" icon={<Search size={22} />}>
        <DevFallbackNotice />
        <div className="search-panel">
          <input
            type="text"
            placeholder="请输入关键字，例如：当事人、校园、婚恋、通报"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                // Trigger action if needed
              }
            }}
          />
          <button onClick={() => {}}>检索</button>
        </div>

        {searchQuery.trim() ? (
          <div className="search-results-section animate-fade">
            <h2>匹配到的在册事件 ({eventTotal})</h2>
            {eventListError ? (
              <ErrorState title="检索失败" body={eventListError} onRetry={() => window.location.reload()} />
            ) : loadingEvents ? (
              <LoadingState />
            ) : eventResults.length === 0 ? (
              <p style={{ color: "var(--text-tertiary)", fontSize: "0.95rem" }}>暂无匹配的事件卷宗。</p>
            ) : (
              <div className="event-grid">
                {eventResults.map((event) => (
                  <EventCard key={event.id} event={event} />
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="state-panel animate-fade" style={{ borderStyle: "solid" }}>
            <FileText />
            <p>等待输入关键词</p>
            <span>输入词后，系统将跨事件主题、主张争议、平台原帖及修订日志进行全局比对。</span>
          </div>
        )}
      </SimplePage>
    );
  }

  if (route.name === "topics") {
    // Collect simulated data or map categories
    const topicCategories = [
      { name: "婚恋与公共争议", slug: "relationship-public-disputes", desc: "关注网络婚恋纠纷、财产争议进入公共讨论后的传播路径与争议结构。", count: 1 },
      { name: "校园公共争议", slug: "campus-public-disputes", desc: "关注校园内公开信举报、导师与学生关系、纪律处分等引起的平台大范围热议事件。", count: 1 },
      { name: "职场性别争议", slug: "workplace-gender", desc: "关于职场待遇、性骚扰指控或劳动纠纷事件的演进存照。", count: 0 },
      { name: "平台治理", slug: "platform-governance", desc: "关于社交平台算法封禁、禁言机制、评论区管控等干预逻辑的个案实录。", count: 0 },
      { name: "司法程序", slug: "judicial-process", desc: "已进入公诉、民事起诉或仲裁阶段，具备官方裁判文书及法庭公开记录的事件记录。", count: 0 },
      { name: "媒体跟进", slug: "media-follow-up", desc: "有专业深度调查记者或机构化媒体进行二次实地采访的事件合集。", count: 0 }
    ];

    pageContent = (
      <SimplePage title="议题地图" eyebrow="Topic Navigation Mapping" icon={<MapIcon size={22} />}>
        <div className="topic-grid">
          {topicCategories.map((item) => (
            <article
              className="topic-card"
              key={item.slug}
              onClick={() => {
                setSelectedTopic(item.slug);
                navigate(`/events?topic=${item.slug}`);
              }}
            >
              <Tags size={24} />
              <h2>{item.name}</h2>
              <p>{item.desc}</p>
              <span>已收录事件：{item.count} 卷</span>
            </article>
          ))}
        </div>
      </SimplePage>
    );
  }

  if (route.name === "sources") {
    pageContent = (
      <SimplePage title="资料源评级体系" eyebrow="Source Reliability Registry" icon={<FileSearch size={22} />}>
        <div className="method-list">
          <article className="method-card">
            <h3>
              <span className="reliability-badge level-a_strong">A 强证据 (A_STRONG)</span>
            </h3>
            <p>
              包括但不限于：官方通报、司法裁判文书、警方立案回执、政府公开文件、行业监管部门的官方处罚决定，以及平台主体官方盖章通告。此类资料源通常具备较高可核验性。
            </p>
          </article>
          
          <article className="method-card">
            <h3>
              <span className="reliability-badge level-b_direct">B 直接材料 (B_DIRECT)</span>
            </h3>
            <p>
              包括但不限于：当事人的实名指控、当事人自己录制的声明视频、律师署名的官方声明、未剪辑的完整沟通音视频、含有完整导出的原始聊天记录备份。该类材料能直接代表当事方立场，但其真实性仍需结合上下文判断。
            </p>
          </article>

          <article className="method-card">
            <h3>
              <span className="reliability-badge level-c_indirect">C 间接材料 (C_INDIRECT)</span>
            </h3>
            <p>
              包括但不限于：具有正规出版刊号的新闻机构发表的调查报道、特约记者的署名采访报道、第三方学术或法律专家的综合案情分析、机构媒体的综合报道。此类资料由于经过第三方媒体的再次加工过滤，属于间接陈述。
            </p>
          </article>

          <article className="method-card">
            <h3>
              <span className="reliability-badge level-d_weak">D 弱线索 (D_WEAK)</span>
            </h3>
            <p>
              包括但不限于：匿名爆料帖、单张无上下文的聊天截图、论坛帖子转述、营销号拼凑整理的传言。此类材料仅能作为时间线起点或舆论发酵的“说法”参照，不能单独作为事实结论依据。
            </p>
          </article>
        </div>
      </SimplePage>
    );
  }

  if (route.name === "methodology") {
    pageContent = (
      <SimplePage title="中立记录方法论" eyebrow="Archival Methodology" icon={<BookOpen size={22} />}>
        <div className="method-list animate-fade">
          <article className="method-card">
            <h3>一、中立记录原则</h3>
            <p>
              档案馆只收录已公开的陈述和可交叉核验的资料链接，并遵循“不做情绪审判、不预设道德偏见、不发表最终判决”的原则。对于仍有争议的内容，在主张矩阵中平行展示多方说法与证据关系，供后续复核。
            </p>
          </article>

          <article className="method-card">
            <h3>二、证据绑定与存照</h3>
            <p>
              事件的所有事实节点，必须绑定至少一个确切资料源链接。档案馆通过后台抓取服务，对原始外链做网页级“镜像存照”并生成 `archiveUrl`，降低删帖、平台干预或链接失效造成的资料断裂风险。
            </p>
          </article>

          <article className="method-card">
            <h3>三、隐私与纠错规则</h3>
            <p>
              为防范网络暴力与非法“人肉”搜索，本馆自动对未成年人姓名、非事件核心方的私人住址、私人电话、私人非公开账号进行化名（Pseudonymization）处理。任何人发现档案存在出入，均可通过纠错通道提供证据修改；符合删除红线的信息将被紧急屏蔽。
            </p>
          </article>

          <article className="method-card">
            <h3>四、版权与公开免责</h3>
            <p>
              档案馆所载的原始链接与缩略图（Thumbnail）均符合合理使用（Fair Use）的规范，旨在为社会学者及法律研究者提供长周期档案，不参与商业化传播。
            </p>
          </article>
        </div>
      </SimplePage>
    );
  }

  if (route.name === "submit") {
    pageContent = (
      <SimplePage title="提交事件线索" eyebrow="Submit Clues" icon={<FileSearch size={22} />}>
        <PublicFeedbackForm kind="submit" />
      </SimplePage>
    );
  }

  if (route.name === "correction") {
    pageContent = (
      <SimplePage title="提交纠错申请" eyebrow="Dossier Correction" icon={<CheckCircle2 size={22} />}>
        <PublicFeedbackForm kind="correction" />
      </SimplePage>
    );
  }

  if (route.name === "report") {
    pageContent = (
      <SimplePage title="紧急申诉与侵权举报" eyebrow="Safety Report Center" icon={<Flag size={22} />}>
        <PublicFeedbackForm kind="report" />
      </SimplePage>
    );
  }

  if (route.name === "admin") {
    if (session.role === "ADMIN") {
      pageContent = <AdminPage section={route.section} />;
    } else if (!sessionLoaded) {
      pageContent = <LoadingState />;
    } else {
      pageContent = <AdminLoginPage onLoginSuccess={setSession} />;
    }
  }

  if (route.name === "admin-login") {
    pageContent = <AdminLoginPage onLoginSuccess={setSession} />;
  }

  return (
    <>
      <Header theme={theme} toggleTheme={toggleTheme} session={session} onLogout={handleLogout} />
      {pageContent}
      <footer>
        <span>公共事件长记忆档案馆 © 2026 / 互联网长记忆项目</span>
        {session.role === "ADMIN" && (
          <button onClick={() => navigate("/admin/events")}>
            进入编辑工作台
          </button>
        )}
      </footer>
    </>
  );
}
