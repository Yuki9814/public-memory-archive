import { useEffect, useMemo, useRef, useState } from "react";
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
  RevisionDiffDto,
  SourceDto,
  TimelineEntryDto,
  SessionDto,
  EventFacetsDto,
  SearchResultDto,
  SourceType,
  ReliabilityLevel,
  ContentKind,
  AvailabilityStatus
} from "@memory-archive/shared";
import { getEventProcessStatusLabel, getReliabilityLabel } from "@memory-archive/shared";
import {
  captureSource,
  createAdminClaim,
  createAdminClaimEvidenceLink,
  createAdminEvidence,
  createAdminEvent,
  createAdminPlatformLink,
  createAdminSource,
  createAdminTimeline,
  createCorrection,
  createReport,
  createSubmission,
  fetchClaims,
  fetchAdminAuditLogs,
  fetchAdminClaims,
  fetchAdminCorrections,
  fetchAdminEventTasks,
  fetchAdminEvidence,
  fetchAdminEvents,
  fetchAdminReports,
  fetchAdminSources,
  fetchAdminSubmissions,
  fetchAdminTask,
  fetchAdminTimeline,
  fetchEventDetail,
  fetchEventFacets,
  fetchEventPage,
  fetchEvents,
  fetchFeedbackStatus,
  fetchPlatformLinks,
  fetchSession,
  fetchSources,
  fetchTimeline,
  fetchVersions,
  fetchRevisionDiff,
  failedChecksFromError,
  isDevMockFallbackEnabled,
  loginAdmin,
  logoutAdmin,
  publishAdminEvent,
  resolveAdminCorrection,
  resolveAdminReport,
  resolveAdminSubmission,
  searchArchive,
  updateAdminEvent,
  type AdminCorrectionDto,
  type AdminEventDto,
  type AdminAuditLogDto,
  type AdminReportDto,
  type AdminSourceDto,
  type AdminSubmissionDto,
  type AdminTaskDto,
  type SubmitReceipt
} from "./api.js";
import { formatDate, getTimeSafe } from "./format-date.js";

// Client-side simple routing
type Route =
  | { name: "home" }
  | { name: "events"; params: URLSearchParams }
  | { name: "event"; slug: string }
  | { name: "search"; params: URLSearchParams }
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
  
  if (path === "/") return { name: "home" };
  if (path === "/events") return { name: "events", params };
  if (path.startsWith("/events/")) return { name: "event", slug: decodeURIComponent(path.split("/")[2] ?? "") };
  if (path === "/search") return { name: "search", params };
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

function searchResultTypeLabel(value: SearchResultDto["type"]) {
  const labels: Record<SearchResultDto["type"], string> = {
    event: "事件",
    source: "来源",
    claim: "主张",
    revision: "修订"
  };
  return labels[value];
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

function captureStatusLabel(value?: string | null) {
  const labels: Record<string, string> = {
    QUEUED: "待抓取",
    RUNNING: "抓取中",
    SUCCEEDED: "已存档",
    FAILED: "存档失败",
    SKIPPED: "已跳过"
  };
  return value ? labels[value] ?? value : "待存档";
}

function feedbackPath(
  kind: "correction" | "report",
  params: {
    eventId?: string;
    eventTitle?: string;
    sourceId?: string | null;
    sourceTitle?: string | null;
    platformLinkId?: string | null;
    platformTitle?: string | null;
  }
) {
  const query = new URLSearchParams();
  if (params.eventId) query.set("eventId", params.eventId);
  if (params.eventTitle) query.set("eventTitle", params.eventTitle);
  if (params.sourceId) query.set("sourceId", params.sourceId);
  if (params.sourceTitle) query.set("sourceTitle", params.sourceTitle);
  if (params.platformLinkId) query.set("platformLinkId", params.platformLinkId);
  if (params.platformTitle) query.set("platformTitle", params.platformTitle);
  return `/${kind === "correction" ? "corrections" : "reports"}${query.toString() ? `?${query.toString()}` : ""}`;
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
  const openEvent = () => navigate(`/events/${event.slug}`);
  return (
    <article
      className="event-card animate-fade"
      role="link"
      tabIndex={0}
      onClick={openEvent}
      onKeyDown={(eventKey) => {
        if (eventKey.key === "Enter" || eventKey.key === " ") {
          eventKey.preventDefault();
          openEvent();
        }
      }}
      aria-label={`查看档案：${event.neutralTitle}`}
    >
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
  const openClaimCount = claims.filter((claim) => claim.importance === "KEY" && (claim.status === "UNVERIFIED" || claim.status === "INSUFFICIENT_EVIDENCE" || claim.status === "DISPUTED")).length;
  const archivedLinkCount = links.filter((link) => !!link.archiveUrl || !!link.capturedAt || link.availabilityStatus === "ARCHIVED_ONLY").length;
  const captureCoverage = links.length > 0 ? Math.round((archivedLinkCount / links.length) * 100) : 0;
  const reliabilityGroups = sources.reduce<Record<string, number>>((acc, source) => {
    acc[source.reliabilityLevel] = (acc[source.reliabilityLevel] ?? 0) + 1;
    return acc;
  }, {});
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
          <span>未决关键主张</span>
          <strong>{openClaimCount}</strong>
        </div>
        <div>
          <span>存档覆盖率</span>
          <strong>{captureCoverage}%</strong>
        </div>
      </div>
      <div className="reliability-strip" aria-label="来源等级分布">
        {["A_STRONG", "B_DIRECT", "C_INDIRECT", "D_WEAK", "UNKNOWN"].map((level) => (
          <span key={level} className={`reliability-badge level-${level.toLowerCase()}`}>
            {reliabilityLabel(level)}：{reliabilityGroups[level] ?? 0}
          </span>
        ))}
      </div>
      <p className="credibility-note">
        当前阶段：{processStatusLabel(event.eventProcessStatus)}。最近版本：
        {latestVersion ? `v${latestVersion.versionNumber}，${formatDate(latestVersion.createdAt)}` : "暂无修订记录"}。已存档外链 {archivedLinkCount}/{links.length}。
      </p>
    </section>
  );
}

// 4. OriginalSourceLinks (Strict contract check)
function OriginalSourceLinks({ event, links }: { event: EventDetailDto; links: PlatformLinkDto[] }) {
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
                    <button
                      type="button"
                      className="inline-feedback-btn"
                      onClick={() => navigate(feedbackPath("report", {
                        eventId: event.id,
                        eventTitle: event.neutralTitle,
                        sourceId: link.sourceId,
                        platformLinkId: link.id,
                        platformTitle: link.title
                      }))}
                    >
                      举报此链接
                    </button>
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
function Timeline({ event, timeline }: { event: EventDetailDto; timeline: TimelineEntryDto[] }) {
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
                  <button
                    type="button"
                    className="inline-feedback-btn"
                    onClick={() => navigate(feedbackPath("correction", {
                      eventId: event.id,
                      eventTitle: event.neutralTitle,
                      sourceId: entry.sourceId,
                      sourceTitle: entry.sourceTitle ?? entry.title
                    }))}
                  >
                    纠错此节点
                  </button>
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
function ClaimMatrix({ event, claims }: { event: EventDetailDto; claims: ClaimDto[] }) {
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
              <div className="claim-actions">
                <button
                  type="button"
                  className="inline-feedback-btn"
                  onClick={() => navigate(feedbackPath("correction", {
                    eventId: event.id,
                    eventTitle: event.neutralTitle,
                    sourceTitle: claim.title
                  }))}
                >
                  纠错此主张
                </button>
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
function EvidenceCabinet({ event, claims }: { event: EventDetailDto; claims: ClaimDto[] }) {
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
              <div className="card-actions compact">
                {item.externalUrl && (
                  <a href={item.externalUrl} target="_blank" rel="noopener noreferrer">
                    打开证据 <ExternalLink size={12} />
                  </a>
                )}
                <button
                  type="button"
                  className="inline-feedback-btn"
                  onClick={() => navigate(feedbackPath("report", {
                    eventId: event.id,
                    eventTitle: event.neutralTitle,
                    sourceId: item.sourceId,
                    sourceTitle: item.sourceTitle ?? item.title
                  }))}
                >
                  举报此证据
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

// 8. SourceList
function SourceList({ event, sources }: { event: EventDetailDto; sources: SourceDto[] }) {
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
                  <span>存档状态：<strong>{captureStatusLabel(source.latestCaptureStatus)}</strong></span>
                  {source.latestCaptureHash && <span>Hash：<strong>{source.latestCaptureHash.slice(0, 12)}</strong></span>}
                </div>
              </div>
              <div className="source-actions">
                {source.url && (
                  <a href={source.url} target="_blank" rel="noopener noreferrer" className="source-open-btn">
                    打开来源
                    <ExternalLink size={12} />
                  </a>
                )}
                <button
                  type="button"
                  className="inline-feedback-btn"
                  onClick={() => navigate(feedbackPath("correction", {
                    eventId: event.id,
                    eventTitle: event.neutralTitle,
                    sourceId: source.id,
                    sourceTitle: source.title
                  }))}
                >
                  纠错此来源
                </button>
                <button
                  type="button"
                  className="inline-feedback-btn danger"
                  onClick={() => navigate(feedbackPath("report", {
                    eventId: event.id,
                    eventTitle: event.neutralTitle,
                    sourceId: source.id,
                    sourceTitle: source.title
                  }))}
                >
                  举报此来源
                </button>
              </div>
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
function RevisionHistory({ slug, versions }: { slug: string; versions: RevisionDto[] }) {
  const [openVersionId, setOpenVersionId] = useState("");
  const [diffs, setDiffs] = useState<Record<string, RevisionDiffDto>>({});
  const [diffError, setDiffError] = useState("");

  const toggleDiff = async (versionId: string) => {
    setDiffError("");
    if (openVersionId === versionId) {
      setOpenVersionId("");
      return;
    }
    setOpenVersionId(versionId);
    if (diffs[versionId]) return;
    try {
      const diff = await fetchRevisionDiff(slug, versionId);
      setDiffs((prev) => ({ ...prev, [versionId]: diff }));
    } catch (err) {
      setDiffError(err instanceof Error ? err.message : "版本差异加载失败");
    }
  };

  const compactValue = (value: unknown) => {
    if (value === null || value === undefined) return "空";
    if (typeof value === "string") return value.length > 120 ? `${value.slice(0, 120)}...` : value;
    return JSON.stringify(value);
  };

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
                <button type="button" className="inline-feedback-btn" onClick={() => void toggleDiff(version.id)}>
                  {openVersionId === version.id ? "收起字段差异" : "查看字段差异"}
                </button>
                {openVersionId === version.id && (
                  <div className="revision-diff">
                    {diffError ? (
                      <span className="field-error">{diffError}</span>
                    ) : !diffs[version.id] ? (
                      <span>加载字段差异中...</span>
                    ) : diffs[version.id].changedFields.length === 0 ? (
                      <span>此版本未检测到字段级差异。</span>
                    ) : (
                      diffs[version.id].changedFields.slice(0, 8).map((field) => (
                        <div key={field.path} className="revision-diff-row">
                          <strong>{field.path}</strong>
                          <span>旧：{compactValue(field.before)}</span>
                          <span>新：{compactValue(field.after)}</span>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

// 13 & 14. CTASection
function CTASection({ type, eventId, enabled = true }: { type: "correction" | "report"; eventId?: string; enabled?: boolean }) {
  const isCorrection = type === "correction";
  const path = `${isCorrection ? "/corrections" : "/reports"}${eventId ? `?eventId=${encodeURIComponent(eventId)}` : ""}`;
  return (
    <article className={`module cta-module ${isCorrection ? "correction" : "report"}`} id={isCorrection ? "correction-cta" : "report-cta"}>
      <div className="module-title">
        {isCorrection ? <CheckCircle2 size={20} /> : <Flag size={20} />}
        <h2>{isCorrection ? "提出纠错" : "紧急举报"}</h2>
      </div>
      <p>
        {!enabled
          ? "该入口当前已根据档案状态临时关闭，编辑部会继续保留内部复核记录。"
          : isCorrection
            ? "我们秉持中立客观的态度。若您发现本档案中存在事实性硬伤、失效的来源链接，或不准确的陈述，欢迎提交详实的佐证资料，协助编辑部进行滚动修订。"
            : "若您发现本档案中包含可能泄露个人隐私（如身份证号、手机、住址等）、人肉爆料、诽谤言论或涉及未成年人等高敏感违法内容，请立即通过紧急通道进行申诉。"}
      </p>
      <button onClick={() => navigate(path)} disabled={!enabled}>
        {isCorrection ? "提交事实纠错说明" : "发起紧急删除/撤稿举报"}
      </button>
    </article>
  );
}

function DetailActionBar({ event }: { event: EventDetailDto }) {
  const correctionPath = `/corrections?eventId=${encodeURIComponent(event.id)}&eventTitle=${encodeURIComponent(event.neutralTitle)}`;
  const reportPath = `/reports?eventId=${encodeURIComponent(event.id)}&eventTitle=${encodeURIComponent(event.neutralTitle)}`;
  return (
    <nav className="detail-action-bar" aria-label="档案反馈操作">
      <button disabled={!event.correctionEnabled} onClick={() => navigate(correctionPath)}>
        <CheckCircle2 size={16} />
        纠错
      </button>
      <button disabled={!event.reportEnabled} onClick={() => navigate(reportPath)}>
        <Flag size={16} />
        举报
      </button>
      <a href={`/api/events/${event.slug}/feed.xml`} target="_blank" rel="noopener noreferrer">
        <History size={16} />
        订阅修订
      </a>
    </nav>
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
      <DetailActionBar event={event} />
      
      <div className="detail-layout">
        <div className="detail-main">
          <CredibilitySummary event={event} claims={claims} sources={sources} links={links} versions={versions} />

          {/* 2. NeutralSummary */}
          <NeutralSummary event={event} />
          
          {/* 3. CurrentStatus */}
          <CurrentStatus event={event} />
          
          {/* 4. OriginalSourceLinks */}
          <OriginalSourceLinks event={event} links={links} />
          
          {/* 5. Timeline */}
          <Timeline event={event} timeline={timeline} />
          
          {/* 6. ClaimMatrix */}
          <ClaimMatrix event={event} claims={claims} />
          
          {/* 7. EvidenceCabinet */}
          <EvidenceCabinet event={event} claims={claims} />
          
          {/* 8. SourceList */}
          <SourceList event={event} sources={sources} />
          
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
          <RevisionHistory slug={event.slug} versions={versions} />
          
          <div className="cta-row">
            {/* 13. CorrectionCTA */}
            <CTASection type="correction" eventId={event.id} enabled={event.correctionEnabled} />
            {/* 14. ReportCTA */}
            <CTASection type="report" eventId={event.id} enabled={event.reportEnabled} />
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
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [feedbackStatus, setFeedbackStatus] = useState("");
  const params = new URLSearchParams(window.location.search);
  const eventTitle = params.get("eventTitle") || "";
  const sourceTitle = params.get("sourceTitle") || "";
  const platformTitle = params.get("platformTitle") || "";

  const copy = {
    submit: ["提交线索", "例如：某平台公开材料、公告页面链接", "线索已受理"],
    correction: ["提交纠错说明", "例如：事实争议描述修正、某失效链接补充", "纠错请求已进入复核"],
    report: ["提交安全举报", "例如：涉及未成年人信息、隐私泄露、人肉风险等", "安全举报已进入复核"]
  }[kind];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const nextErrors: Record<string, string> = {};
    if (!title.trim()) nextErrors.title = "请填写标题。";
    if (!description.trim()) nextErrors.description = "请填写详细说明。";
    if (url.trim()) {
      try {
        const parsed = new URL(url.trim());
        if (parsed.protocol !== "http:" && parsed.protocol !== "https:") nextErrors.url = "链接必须使用 http 或 https。";
      } catch {
        nextErrors.url = "请输入有效链接。";
      }
    }
    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors);
      return;
    }
    setFieldErrors({});

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
                body: `${description.trim()}${urlNote}`
              })
            : await createReport({
                eventId,
                sourceId,
                platformLinkId,
                reportType,
                reporterEmail: cleanEmail,
                body: `举报标题：${title.trim()}\n\n${description.trim()}${urlNote}`
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
        {feedbackStatus && <p className="feedback-status-line">{feedbackStatus}</p>}

        <div className="form-success-actions">
          <button onClick={async () => {
            const status = await fetchFeedbackStatus(receipt.id);
            setFeedbackStatus(`当前公开处理状态：${queueStatusLabel(status.status)}${status.priorityLabel === "urgent" ? "，高优先级安全复核" : ""}`);
          }}>
            查询处理状态
          </button>
          <button onClick={() => {
            setReceipt(null);
            setTitle("");
            setDescription("");
            setUrl("");
            setEmail("");
            setError("");
            setFeedbackStatus("");
          }}>
            继续提交
          </button>
        </div>
      </div>
    );
  }

  return (
    <form className="archive-form" onSubmit={handleSubmit}>
      {(eventTitle || sourceTitle || platformTitle) && (
        <div className="feedback-context">
          <strong>关联对象</strong>
          {eventTitle && <span>卷宗：{eventTitle}</span>}
          {sourceTitle && <span>来源：{sourceTitle}</span>}
          {platformTitle && <span>外链：{platformTitle}</span>}
        </div>
      )}
      <label>
        内容摘要/标题
        <input
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={`请输入简要的${copy[0]}标题`}
        />
        {fieldErrors.title && <span className="field-error">{fieldErrors.title}</span>}
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
        {fieldErrors.description && <span className="field-error">{fieldErrors.description}</span>}
      </label>

      <label>
        佐证材料链接 (可选)
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://example.com/source-link"
        />
        {fieldErrors.url && <span className="field-error">{fieldErrors.url}</span>}
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
    evidence: "后台证据编辑",
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
  const [selectedAdminEventId, setSelectedAdminEventId] = useState("");
  const [adminSources, setAdminSources] = useState<AdminSourceDto[]>([]);
  const [captureResult, setCaptureResult] = useState<{ taskId: string; queued: boolean } | null>(null);
  const [taskLookupId, setTaskLookupId] = useState("");
  const [taskDetail, setTaskDetail] = useState<AdminTaskDto | null>(null);
  const [adminTimeline, setAdminTimeline] = useState<TimelineEntryDto[]>([]);
  const [adminClaims, setAdminClaims] = useState<ClaimDto[]>([]);
  const [adminEvidence, setAdminEvidence] = useState<ClaimDto["evidenceLinks"][number]["evidence"][]>([]);
  const [adminTasks, setAdminTasks] = useState<AdminTaskDto[]>([]);
  const [auditLogs, setAuditLogs] = useState<AdminAuditLogDto[]>([]);
  const [resolutionNotes, setResolutionNotes] = useState<Record<string, string>>({});
  const [resolutionLinks, setResolutionLinks] = useState<Record<string, { entityType: string; entityId: string; action: string }>>({});
  const [eventForm, setEventForm] = useState({
    id: "",
    slug: "",
    title: "",
    neutralTitle: "",
    summary: "",
    eventProcessStatus: "UNVERIFIED",
    occurredAt: "",
    whatWeKnow: "",
    whatIsDisputed: "",
    whatNotToInfer: "",
    latestUpdates: ""
  });
  const [sourceForm, setSourceForm] = useState({
    eventId: "",
    title: "",
    url: "",
    sourceType: "OTHER",
    reliabilityLevel: "UNKNOWN",
    publisher: "",
    authorDisplay: "",
    publishedAt: "",
    summary: ""
  });
  const [platformLinkForm, setPlatformLinkForm] = useState({
    eventId: "",
    sourceId: "",
    platform: "OTHER",
    contentKind: "POST",
    originalUrl: "",
    canonicalUrl: "",
    title: "",
    description: "",
    authorDisplay: "",
    thumbnailUrl: "",
    publishedAt: "",
    availabilityStatus: "UNKNOWN",
    archiveUrl: ""
  });
  const [timelineForm, setTimelineForm] = useState({
    title: "",
    body: "",
    happenedAt: "",
    sourceId: "",
    sortOrder: "0"
  });
  const [claimForm, setClaimForm] = useState({
    title: "",
    statement: "",
    status: "UNVERIFIED",
    importance: "KEY",
    sourceId: ""
  });
  const [evidenceForm, setEvidenceForm] = useState({
    title: "",
    description: "",
    evidenceKind: "OTHER",
    reliabilityLevel: "UNKNOWN",
    sourceId: "",
    storageUrl: "",
    externalUrl: "",
    capturedAt: ""
  });
  const [claimLinkForm, setClaimLinkForm] = useState({
    claimId: "",
    evidenceId: "",
    relationType: "SUPPORTS",
    notes: ""
  });

  const splitLines = (value: string) => value.split("\n").map((line) => line.trim()).filter(Boolean);
  const cleanOptional = (value: string) => value.trim() || undefined;

	  const loadAdminData = async () => {
    setAdminLoading(true);
    setAdminError("");
    setAdminMessage("");
    try {
	      if (section === "events" || section === "sources" || section === "platform-links" || section === "evidence") {
	        const data = await fetchAdminEvents({ pageSize: 50 });
	        setAdminEvents(data.items);
          if (!selectedAdminEventId && data.items[0]) {
            setSelectedAdminEventId(data.items[0].id);
          }
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

  useEffect(() => {
    if (!selectedAdminEventId) return;
    fetchAdminSources(selectedAdminEventId)
      .then((data) => setAdminSources(data.items))
      .catch(() => setAdminSources([]));
  }, [selectedAdminEventId]);

  useEffect(() => {
    if (!selectedAdminEventId || (section !== "evidence" && section !== "sources")) return;
    if (section === "sources") {
      fetchAdminEventTasks(selectedAdminEventId)
        .then((taskData) => setAdminTasks(taskData.items))
        .catch(() => setAdminTasks([]));
      return;
    }
    Promise.all([
      fetchAdminTimeline(selectedAdminEventId),
      fetchAdminClaims(selectedAdminEventId),
      fetchAdminEvidence(selectedAdminEventId),
      fetchAdminEventTasks(selectedAdminEventId),
      fetchAdminAuditLogs({ entityType: "Event", entityId: selectedAdminEventId })
    ])
      .then(([timelineData, claimData, evidenceData, taskData, auditData]) => {
        setAdminTimeline(timelineData.items);
        setAdminClaims(claimData.items);
        setAdminEvidence(evidenceData.items);
        setAdminTasks(taskData.items);
        setAuditLogs(auditData);
      })
      .catch((err) => setAdminError(err instanceof Error ? err.message : "证据工作区加载失败"));
  }, [selectedAdminEventId, section, adminMessage]);

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
      const link = resolutionLinks[item.id];
      await resolveAdminSubmission(item.id, {
        status,
        resolutionNotes: resolutionNotes[item.id]?.trim() || (status === "REVIEWED" ? "已完成初步复核。" : status === "ACCEPTED" ? "已采纳为编辑材料。" : "经复核暂不采纳。"),
        resolutionAction: link?.action || (status === "ACCEPTED" ? "accepted_as_material" : status.toLowerCase()),
        linkedEntityType: link?.entityType || undefined,
        linkedEntityId: link?.entityId || undefined
      });
      setAdminMessage(`线索 ${item.id} 已更新为 ${queueStatusLabel(status)}。`);
      await loadAdminData();
    } catch (err) {
      setAdminError(err instanceof Error ? err.message : "线索处理失败");
    }
  };

  const handleCorrectionAction = async (item: AdminCorrectionDto, status: "ACCEPTED" | "REJECTED" | "RESOLVED") => {
    setAdminError("");
    try {
      const link = resolutionLinks[item.id];
      await resolveAdminCorrection(item.id, {
        status,
        resolutionNotes: resolutionNotes[item.id]?.trim() || (status === "REJECTED" ? "经复核暂不采纳。" : "已按关联对象完成复核处理。"),
        resolutionAction: link?.action || (status === "REJECTED" ? "rejected_after_review" : "linked_entity_updated"),
        linkedEntityType: link?.entityType || (item.sourceId ? "Source" : item.eventId ? "Event" : undefined),
        linkedEntityId: link?.entityId || item.sourceId || item.eventId || undefined
      });
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

  const handleSaveEvent = async () => {
    setAdminError("");
    const payload = {
      slug: eventForm.slug.trim(),
      title: eventForm.title.trim(),
      neutralTitle: eventForm.neutralTitle.trim(),
      summary: eventForm.summary.trim(),
      eventProcessStatus: eventForm.eventProcessStatus as EventDetailDto["eventProcessStatus"],
      occurredAt: cleanOptional(eventForm.occurredAt),
      whatWeKnow: splitLines(eventForm.whatWeKnow),
      whatIsDisputed: splitLines(eventForm.whatIsDisputed),
      whatNotToInfer: splitLines(eventForm.whatNotToInfer),
      latestUpdates: splitLines(eventForm.latestUpdates)
    };
    try {
      if (eventForm.id) {
        await updateAdminEvent(eventForm.id, payload);
        setAdminMessage("事件草稿已更新。");
      } else {
        await createAdminEvent(payload);
        setAdminMessage("事件草稿已创建。");
      }
      setEventForm((prev) => ({ ...prev, id: "" }));
      await loadAdminData();
    } catch (err) {
      setAdminError(err instanceof Error ? err.message : "事件保存失败");
    }
  };

  const handleLoadEventIntoForm = (event: AdminEventDto) => {
    setEventForm({
      id: event.id,
      slug: event.slug,
      title: event.title,
      neutralTitle: event.neutralTitle,
      summary: event.summary,
      eventProcessStatus: event.eventProcessStatus,
      occurredAt: "",
      whatWeKnow: "",
      whatIsDisputed: "",
      whatNotToInfer: "",
      latestUpdates: ""
    });
    setSelectedAdminEventId(event.id);
  };

  const handleCreateSource = async () => {
    const eventId = sourceForm.eventId || selectedAdminEventId;
    if (!eventId) {
      setAdminError("请先选择事件。");
      return;
    }
    setAdminError("");
    try {
      await createAdminSource(eventId, {
        title: sourceForm.title.trim(),
        url: cleanOptional(sourceForm.url),
        sourceType: sourceForm.sourceType as SourceType,
        reliabilityLevel: sourceForm.reliabilityLevel as ReliabilityLevel,
        publisher: cleanOptional(sourceForm.publisher),
        authorDisplay: cleanOptional(sourceForm.authorDisplay),
        publishedAt: cleanOptional(sourceForm.publishedAt),
        summary: sourceForm.summary.trim()
      });
      setAdminMessage("来源已新增。");
      setSourceForm((prev) => ({ ...prev, title: "", url: "", publisher: "", authorDisplay: "", publishedAt: "", summary: "" }));
      setSelectedAdminEventId(eventId);
      setAdminSources((await fetchAdminSources(eventId)).items);
    } catch (err) {
      setAdminError(err instanceof Error ? err.message : "来源新增失败");
    }
  };

  const handleCreatePlatformLink = async () => {
    const eventId = platformLinkForm.eventId || selectedAdminEventId;
    if (!eventId) {
      setAdminError("请先选择事件。");
      return;
    }
    setAdminError("");
    try {
      await createAdminPlatformLink(eventId, {
        sourceId: cleanOptional(platformLinkForm.sourceId),
        platform: platformLinkForm.platform as PlatformLinkDto["platform"],
        contentKind: platformLinkForm.contentKind as ContentKind,
        originalUrl: platformLinkForm.originalUrl.trim(),
        canonicalUrl: cleanOptional(platformLinkForm.canonicalUrl),
        title: platformLinkForm.title.trim(),
        description: platformLinkForm.description.trim(),
        authorDisplay: cleanOptional(platformLinkForm.authorDisplay),
        thumbnailUrl: cleanOptional(platformLinkForm.thumbnailUrl),
        publishedAt: cleanOptional(platformLinkForm.publishedAt),
        availabilityStatus: platformLinkForm.availabilityStatus as AvailabilityStatus,
        archiveUrl: cleanOptional(platformLinkForm.archiveUrl)
      });
      setAdminMessage("平台外链已新增。");
      setPlatformLinkForm((prev) => ({ ...prev, originalUrl: "", canonicalUrl: "", title: "", description: "", authorDisplay: "", thumbnailUrl: "", archiveUrl: "" }));
      setAdminSources((await fetchAdminSources(eventId)).items);
    } catch (err) {
      setAdminError(err instanceof Error ? err.message : "平台外链新增失败");
    }
  };

  const handleCreateTimeline = async () => {
    if (!selectedAdminEventId) {
      setAdminError("请先选择事件。");
      return;
    }
    setAdminError("");
    try {
      await createAdminTimeline(selectedAdminEventId, {
        title: timelineForm.title.trim(),
        body: timelineForm.body.trim(),
        happenedAt: timelineForm.happenedAt,
        sourceId: cleanOptional(timelineForm.sourceId),
        sortOrder: Number(timelineForm.sortOrder || "0")
      });
      setTimelineForm({ title: "", body: "", happenedAt: "", sourceId: "", sortOrder: "0" });
      setAdminMessage("时间线节点已新增。");
    } catch (err) {
      setAdminError(err instanceof Error ? err.message : "时间线新增失败");
    }
  };

  const handleCreateClaim = async () => {
    if (!selectedAdminEventId) {
      setAdminError("请先选择事件。");
      return;
    }
    setAdminError("");
    try {
      await createAdminClaim(selectedAdminEventId, {
        title: claimForm.title.trim(),
        statement: claimForm.statement.trim(),
        status: claimForm.status as ClaimDto["status"],
        importance: claimForm.importance as ClaimDto["importance"],
        sourceId: cleanOptional(claimForm.sourceId)
      });
      setClaimForm((prev) => ({ ...prev, title: "", statement: "" }));
      setAdminMessage("主张已新增。");
    } catch (err) {
      setAdminError(err instanceof Error ? err.message : "主张新增失败");
    }
  };

  const handleCreateEvidence = async () => {
    if (!selectedAdminEventId) {
      setAdminError("请先选择事件。");
      return;
    }
    setAdminError("");
    try {
      await createAdminEvidence(selectedAdminEventId, {
        title: evidenceForm.title.trim(),
        description: evidenceForm.description.trim(),
        evidenceKind: evidenceForm.evidenceKind,
        reliabilityLevel: evidenceForm.reliabilityLevel as ReliabilityLevel,
        sourceId: cleanOptional(evidenceForm.sourceId),
        storageUrl: cleanOptional(evidenceForm.storageUrl),
        externalUrl: cleanOptional(evidenceForm.externalUrl),
        capturedAt: cleanOptional(evidenceForm.capturedAt)
      });
      setEvidenceForm((prev) => ({ ...prev, title: "", description: "", storageUrl: "", externalUrl: "" }));
      setAdminMessage("证据已新增。");
    } catch (err) {
      setAdminError(err instanceof Error ? err.message : "证据新增失败");
    }
  };

  const handleCreateClaimEvidenceLink = async () => {
    if (!claimLinkForm.claimId || !claimLinkForm.evidenceId) {
      setAdminError("请先选择主张和证据。");
      return;
    }
    setAdminError("");
    try {
      await createAdminClaimEvidenceLink(claimLinkForm.claimId, {
        evidenceId: claimLinkForm.evidenceId,
        relationType: claimLinkForm.relationType as "SUPPORTS" | "OPPOSES" | "NEUTRAL" | "COMPLICATES",
        notes: cleanOptional(claimLinkForm.notes)
      });
      setClaimLinkForm((prev) => ({ ...prev, notes: "" }));
      setAdminMessage("主张与证据已关联。");
    } catch (err) {
      setAdminError(err instanceof Error ? err.message : "证据关联失败");
    }
  };

  return (
    <SimplePage title={titles[section] ?? "后台管理台"} eyebrow="Editorial Control Center" icon={<Database />}>
      <div className="admin-grid">
        {["events", "sources", "platform-links", "evidence", "review", "reports"].map((item) => (
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
              <div className="admin-tool-card">
                <h3>{eventForm.id ? "编辑事件草稿" : "创建事件草稿"}</h3>
                <div className="admin-form-grid">
                  <label>Slug<input value={eventForm.slug} onChange={(e) => setEventForm((prev) => ({ ...prev, slug: e.target.value }))} placeholder="public-case-slug" /></label>
                  <label>原始标题<input value={eventForm.title} onChange={(e) => setEventForm((prev) => ({ ...prev, title: e.target.value }))} /></label>
                  <label>中性标题<input value={eventForm.neutralTitle} onChange={(e) => setEventForm((prev) => ({ ...prev, neutralTitle: e.target.value }))} /></label>
                  <label>进展状态
                    <select value={eventForm.eventProcessStatus} onChange={(e) => setEventForm((prev) => ({ ...prev, eventProcessStatus: e.target.value }))}>
                      <option value="UNVERIFIED">材料收集中</option>
                      <option value="DEVELOPING">讨论扩散中</option>
                      <option value="PLATFORM_INTERVENED">平台回应后</option>
                      <option value="OFFICIAL_INVESTIGATION">机构核验中</option>
                      <option value="LEGAL_PROCESS">程序推进中</option>
                      <option value="CONCLUDED">阶段性收束</option>
                    </select>
                  </label>
                  <label>发生时间<input type="datetime-local" value={eventForm.occurredAt} onChange={(e) => setEventForm((prev) => ({ ...prev, occurredAt: e.target.value }))} /></label>
                </div>
                <label>摘要<textarea value={eventForm.summary} onChange={(e) => setEventForm((prev) => ({ ...prev, summary: e.target.value }))} /></label>
                <div className="admin-form-grid">
                  <label>已知事实<textarea value={eventForm.whatWeKnow} onChange={(e) => setEventForm((prev) => ({ ...prev, whatWeKnow: e.target.value }))} placeholder="一行一条" /></label>
                  <label>仍有争议<textarea value={eventForm.whatIsDisputed} onChange={(e) => setEventForm((prev) => ({ ...prev, whatIsDisputed: e.target.value }))} placeholder="一行一条" /></label>
                  <label>不应推断<textarea value={eventForm.whatNotToInfer} onChange={(e) => setEventForm((prev) => ({ ...prev, whatNotToInfer: e.target.value }))} placeholder="一行一条" /></label>
                  <label>最近更新<textarea value={eventForm.latestUpdates} onChange={(e) => setEventForm((prev) => ({ ...prev, latestUpdates: e.target.value }))} placeholder="一行一条" /></label>
                </div>
                <button onClick={handleSaveEvent}><Check size={14} /> {eventForm.id ? "保存事件" : "创建草稿"}</button>
              </div>
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
                      <button onClick={() => handleLoadEventIntoForm(event)}>
                        <FileText size={14} /> 编辑
                      </button>
	                    <button onClick={() => navigate(`/events/${event.slug}`)} disabled={event.editorialStatus !== "PUBLISHED"}>
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
                <h3>选择事件与新增来源</h3>
                <label>
                  事件
                  <select value={selectedAdminEventId} onChange={(e) => {
                    setSelectedAdminEventId(e.target.value);
                    setSourceForm((prev) => ({ ...prev, eventId: e.target.value }));
                    setPlatformLinkForm((prev) => ({ ...prev, eventId: e.target.value, sourceId: "" }));
                  }}>
                    <option value="">请选择事件</option>
                    {adminEvents.map((event) => <option key={event.id} value={event.id}>{event.neutralTitle}</option>)}
                  </select>
                </label>
                <label>来源标题<input value={sourceForm.title} onChange={(e) => setSourceForm((prev) => ({ ...prev, title: e.target.value }))} /></label>
                <label>来源 URL<input value={sourceForm.url} onChange={(e) => setSourceForm((prev) => ({ ...prev, url: e.target.value }))} placeholder="https://example.com" /></label>
                <div className="admin-form-grid">
                  <label>来源类型
                    <select value={sourceForm.sourceType} onChange={(e) => setSourceForm((prev) => ({ ...prev, sourceType: e.target.value }))}>
                      <option value="OFFICIAL_NOTICE">官方说明</option>
                      <option value="MEDIA_REPORT">媒体报道</option>
                      <option value="ORIGINAL_POST">原始帖子</option>
                      <option value="VIDEO">视频</option>
                      <option value="NOTE">笔记</option>
                      <option value="OTHER">其他</option>
                    </select>
                  </label>
                  <label>可靠等级
                    <select value={sourceForm.reliabilityLevel} onChange={(e) => setSourceForm((prev) => ({ ...prev, reliabilityLevel: e.target.value }))}>
                      <option value="A_STRONG">A 强证据</option>
                      <option value="B_DIRECT">B 直接材料</option>
                      <option value="C_INDIRECT">C 间接材料</option>
                      <option value="D_WEAK">D 弱线索</option>
                      <option value="UNKNOWN">未定级</option>
                    </select>
                  </label>
                </div>
                <label>发布者<input value={sourceForm.publisher} onChange={(e) => setSourceForm((prev) => ({ ...prev, publisher: e.target.value }))} /></label>
                <label>作者展示名<input value={sourceForm.authorDisplay} onChange={(e) => setSourceForm((prev) => ({ ...prev, authorDisplay: e.target.value }))} /></label>
                <label>发布时间<input type="datetime-local" value={sourceForm.publishedAt} onChange={(e) => setSourceForm((prev) => ({ ...prev, publishedAt: e.target.value }))} /></label>
                <label>来源摘要<textarea value={sourceForm.summary} onChange={(e) => setSourceForm((prev) => ({ ...prev, summary: e.target.value }))} /></label>
                <button onClick={handleCreateSource}><Check size={14} /> 新增来源</button>
              </div>
	            <div className="admin-tool-card">
	              <h3>创建来源抓取任务</h3>
	              <label>
	                来源
	                <select value={sourceIdInput} onChange={(e) => setSourceIdInput(e.target.value)}>
                    <option value="">请选择来源</option>
                    {adminSources.map((source) => <option key={source.id} value={source.id}>{source.title}</option>)}
                  </select>
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
            <div className="admin-tool-card">
              <h3>当前事件抓取任务</h3>
              <div className="task-detail">
                {adminTasks.length === 0 ? (
                  <span>暂无抓取任务。</span>
                ) : (
                  adminTasks.slice(0, 8).map((task) => (
                    <small key={task.id}>
                      {task.id} | {queueStatusLabel(task.status)} | {task.progress}% {task.errorMessage ? `| ${task.errorMessage}` : ""}
                      {(task.captures ?? []).map((capture) => ` | ${capture.captureStatus}:${capture.contentHash?.slice(0, 10) ?? capture.errorMessage ?? capture.originalUrl}`)}
                    </small>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {!adminLoading && section === "evidence" && (
          <div className="admin-tool-stack">
            <div className="admin-tool-card">
              <h3>选择事件</h3>
              <label>
                事件
                <select value={selectedAdminEventId} onChange={(e) => setSelectedAdminEventId(e.target.value)}>
                  <option value="">请选择事件</option>
                  {adminEvents.map((event) => <option key={event.id} value={event.id}>{event.neutralTitle}</option>)}
                </select>
              </label>
              <div className="admin-form-grid">
                <span>来源 {adminSources.length}</span>
                <span>时间线 {adminTimeline.length}</span>
                <span>主张 {adminClaims.length}</span>
                <span>证据 {adminEvidence.length}</span>
              </div>
            </div>

            <div className="admin-tool-card">
              <h3>新增时间线节点</h3>
              <div className="admin-form-grid">
                <label>标题<input value={timelineForm.title} onChange={(e) => setTimelineForm((prev) => ({ ...prev, title: e.target.value }))} /></label>
                <label>发生时间<input type="datetime-local" value={timelineForm.happenedAt} onChange={(e) => setTimelineForm((prev) => ({ ...prev, happenedAt: e.target.value }))} /></label>
                <label>绑定来源
                  <select value={timelineForm.sourceId} onChange={(e) => setTimelineForm((prev) => ({ ...prev, sourceId: e.target.value }))}>
                    <option value="">未绑定</option>
                    {adminSources.map((source) => <option key={source.id} value={source.id}>{source.title}</option>)}
                  </select>
                </label>
                <label>排序<input type="number" value={timelineForm.sortOrder} onChange={(e) => setTimelineForm((prev) => ({ ...prev, sortOrder: e.target.value }))} /></label>
              </div>
              <label>节点说明<textarea value={timelineForm.body} onChange={(e) => setTimelineForm((prev) => ({ ...prev, body: e.target.value }))} /></label>
              <button onClick={handleCreateTimeline}><Clock3 size={14} /> 新增时间线</button>
            </div>

            <div className="admin-tool-card">
              <h3>新增主张</h3>
              <div className="admin-form-grid">
                <label>标题<input value={claimForm.title} onChange={(e) => setClaimForm((prev) => ({ ...prev, title: e.target.value }))} /></label>
                <label>状态
                  <select value={claimForm.status} onChange={(e) => setClaimForm((prev) => ({ ...prev, status: e.target.value }))}>
                    <option value="UNVERIFIED">未核验</option>
                    <option value="INSUFFICIENT_EVIDENCE">证据不足</option>
                    <option value="DISPUTED">有争议</option>
                    <option value="PARTIALLY_SUPPORTED">部分支持</option>
                    <option value="SUPPORTED">已支持</option>
                    <option value="REFUTED">已驳回</option>
                  </select>
                </label>
                <label>重要度
                  <select value={claimForm.importance} onChange={(e) => setClaimForm((prev) => ({ ...prev, importance: e.target.value }))}>
                    <option value="KEY">关键</option>
                    <option value="CONTEXT">背景</option>
                    <option value="LOW">低</option>
                  </select>
                </label>
                <label>来源
                  <select value={claimForm.sourceId} onChange={(e) => setClaimForm((prev) => ({ ...prev, sourceId: e.target.value }))}>
                    <option value="">未绑定</option>
                    {adminSources.map((source) => <option key={source.id} value={source.id}>{source.title}</option>)}
                  </select>
                </label>
              </div>
              <label>主张正文<textarea value={claimForm.statement} onChange={(e) => setClaimForm((prev) => ({ ...prev, statement: e.target.value }))} /></label>
              <button onClick={handleCreateClaim}><TriangleAlert size={14} /> 新增主张</button>
            </div>

            <div className="admin-tool-card">
              <h3>新增证据</h3>
              <div className="admin-form-grid">
                <label>标题<input value={evidenceForm.title} onChange={(e) => setEvidenceForm((prev) => ({ ...prev, title: e.target.value }))} /></label>
                <label>类型
                  <select value={evidenceForm.evidenceKind} onChange={(e) => setEvidenceForm((prev) => ({ ...prev, evidenceKind: e.target.value }))}>
                    <option value="DOCUMENT">文档</option>
                    <option value="SCREENSHOT">截图</option>
                    <option value="VIDEO">视频</option>
                    <option value="AUDIO">音频</option>
                    <option value="POST">帖子</option>
                    <option value="COMMENT">评论</option>
                    <option value="ARTICLE">文章</option>
                    <option value="ARCHIVE_CAPTURE">存档抓取</option>
                    <option value="OTHER">其他</option>
                  </select>
                </label>
                <label>可靠等级
                  <select value={evidenceForm.reliabilityLevel} onChange={(e) => setEvidenceForm((prev) => ({ ...prev, reliabilityLevel: e.target.value }))}>
                    <option value="A_STRONG">A 强证据</option>
                    <option value="B_DIRECT">B 直接材料</option>
                    <option value="C_INDIRECT">C 间接材料</option>
                    <option value="D_WEAK">D 弱线索</option>
                    <option value="UNKNOWN">未定级</option>
                  </select>
                </label>
                <label>来源
                  <select value={evidenceForm.sourceId} onChange={(e) => setEvidenceForm((prev) => ({ ...prev, sourceId: e.target.value }))}>
                    <option value="">未绑定</option>
                    {adminSources.map((source) => <option key={source.id} value={source.id}>{source.title}</option>)}
                  </select>
                </label>
              </div>
              <label>说明<textarea value={evidenceForm.description} onChange={(e) => setEvidenceForm((prev) => ({ ...prev, description: e.target.value }))} /></label>
              <div className="admin-form-grid">
                <label>存储 URL<input value={evidenceForm.storageUrl} onChange={(e) => setEvidenceForm((prev) => ({ ...prev, storageUrl: e.target.value }))} /></label>
                <label>外部 URL<input value={evidenceForm.externalUrl} onChange={(e) => setEvidenceForm((prev) => ({ ...prev, externalUrl: e.target.value }))} /></label>
                <label>抓取时间<input type="datetime-local" value={evidenceForm.capturedAt} onChange={(e) => setEvidenceForm((prev) => ({ ...prev, capturedAt: e.target.value }))} /></label>
              </div>
              <button onClick={handleCreateEvidence}><Archive size={14} /> 新增证据</button>
            </div>

            <div className="admin-tool-card">
              <h3>关联主张与证据</h3>
              <div className="admin-form-grid">
                <label>主张
                  <select value={claimLinkForm.claimId} onChange={(e) => setClaimLinkForm((prev) => ({ ...prev, claimId: e.target.value }))}>
                    <option value="">请选择主张</option>
                    {adminClaims.map((claim) => <option key={claim.id} value={claim.id}>{claim.title}</option>)}
                  </select>
                </label>
                <label>证据
                  <select value={claimLinkForm.evidenceId} onChange={(e) => setClaimLinkForm((prev) => ({ ...prev, evidenceId: e.target.value }))}>
                    <option value="">请选择证据</option>
                    {adminEvidence.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
                  </select>
                </label>
                <label>关系
                  <select value={claimLinkForm.relationType} onChange={(e) => setClaimLinkForm((prev) => ({ ...prev, relationType: e.target.value }))}>
                    <option value="SUPPORTS">支持</option>
                    <option value="OPPOSES">相反</option>
                    <option value="NEUTRAL">中性</option>
                    <option value="COMPLICATES">补充复杂性</option>
                  </select>
                </label>
              </div>
              <label>关联说明<textarea value={claimLinkForm.notes} onChange={(e) => setClaimLinkForm((prev) => ({ ...prev, notes: e.target.value }))} /></label>
              <button onClick={handleCreateClaimEvidenceLink}><Link2 size={14} /> 建立关联</button>
            </div>

            <div className="admin-tool-card">
              <h3>抓取任务与审计记录</h3>
              <div className="task-detail">
                {adminTasks.slice(0, 6).map((task) => (
                  <small key={task.id}>
                    {task.id} | {task.type} | {queueStatusLabel(task.status)} | {task.progress}% {task.errorMessage ? `| ${task.errorMessage}` : ""}
                  </small>
                ))}
                {auditLogs.slice(0, 6).map((log) => (
                  <small key={log.id}>{formatDate(log.createdAt)} | {log.action} | {log.entityType}:{log.entityId}</small>
                ))}
              </div>
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
                  {item.resolutionNotes && <span className="admin-item-meta">处理记录：{item.resolutionNotes}</span>}
                </div>
                <div className="admin-resolution-fields">
                  <label>处理说明
                    <textarea
                      value={resolutionNotes[item.id] ?? ""}
                      onChange={(e) => setResolutionNotes((prev) => ({ ...prev, [item.id]: e.target.value }))}
                      placeholder="记录采纳、驳回或转化方式"
                    />
                  </label>
                  <div className="admin-form-grid">
                    <label>关联类型<input value={resolutionLinks[item.id]?.entityType ?? ""} onChange={(e) => setResolutionLinks((prev) => ({ ...prev, [item.id]: { ...(prev[item.id] ?? { entityId: "", action: "" }), entityType: e.target.value } }))} placeholder="Event / Source" /></label>
                    <label>关联 ID<input value={resolutionLinks[item.id]?.entityId ?? ""} onChange={(e) => setResolutionLinks((prev) => ({ ...prev, [item.id]: { ...(prev[item.id] ?? { entityType: "", action: "" }), entityId: e.target.value } }))} /></label>
                    <label>处理动作<input value={resolutionLinks[item.id]?.action ?? ""} onChange={(e) => setResolutionLinks((prev) => ({ ...prev, [item.id]: { ...(prev[item.id] ?? { entityType: "", entityId: "" }), action: e.target.value } }))} placeholder="converted_to_source" /></label>
                  </div>
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
                  {item.resolutionNotes && <span className="admin-item-meta">处理记录：{item.resolutionNotes}</span>}
                </div>
                <div className="admin-resolution-fields">
                  <label>处理说明
                    <textarea
                      value={resolutionNotes[item.id] ?? ""}
                      onChange={(e) => setResolutionNotes((prev) => ({ ...prev, [item.id]: e.target.value }))}
                      placeholder="记录目标对象已如何修正"
                    />
                  </label>
                  <div className="admin-form-grid">
                    <label>关联类型<input value={resolutionLinks[item.id]?.entityType ?? ""} onChange={(e) => setResolutionLinks((prev) => ({ ...prev, [item.id]: { ...(prev[item.id] ?? { entityId: "", action: "" }), entityType: e.target.value } }))} placeholder="Event / Source / Claim" /></label>
                    <label>关联 ID<input value={resolutionLinks[item.id]?.entityId ?? ""} onChange={(e) => setResolutionLinks((prev) => ({ ...prev, [item.id]: { ...(prev[item.id] ?? { entityType: "", action: "" }), entityId: e.target.value } }))} /></label>
                    <label>处理动作<input value={resolutionLinks[item.id]?.action ?? ""} onChange={(e) => setResolutionLinks((prev) => ({ ...prev, [item.id]: { ...(prev[item.id] ?? { entityType: "", entityId: "" }), action: e.target.value } }))} placeholder="linked_entity_updated" /></label>
                  </div>
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
            <div className="admin-tool-card">
              <h3>新增平台外链</h3>
              <label>
                事件
                <select value={selectedAdminEventId} onChange={(e) => {
                  setSelectedAdminEventId(e.target.value);
                  setPlatformLinkForm((prev) => ({ ...prev, eventId: e.target.value, sourceId: "" }));
                }}>
                  <option value="">请选择事件</option>
                  {adminEvents.map((event) => <option key={event.id} value={event.id}>{event.neutralTitle}</option>)}
                </select>
              </label>
              <label>
                绑定来源
                <select value={platformLinkForm.sourceId} onChange={(e) => setPlatformLinkForm((prev) => ({ ...prev, sourceId: e.target.value }))}>
                  <option value="">不选择，自动创建来源</option>
                  {adminSources.map((source) => <option key={source.id} value={source.id}>{source.title}</option>)}
                </select>
              </label>
              <div className="admin-form-grid">
                <label>平台
                  <select value={platformLinkForm.platform} onChange={(e) => setPlatformLinkForm((prev) => ({ ...prev, platform: e.target.value }))}>
                    <option value="BILIBILI">B站</option>
                    <option value="XIAOHONGSHU">小红书</option>
                    <option value="WEIBO">微博</option>
                    <option value="DOUYIN">抖音</option>
                    <option value="ZHIHU">知乎</option>
                    <option value="OTHER">其他</option>
                  </select>
                </label>
                <label>内容类型
                  <select value={platformLinkForm.contentKind} onChange={(e) => setPlatformLinkForm((prev) => ({ ...prev, contentKind: e.target.value }))}>
                    <option value="VIDEO">视频</option>
                    <option value="NOTE">笔记</option>
                    <option value="POST">帖子</option>
                    <option value="ARTICLE">文章</option>
                    <option value="COMMENT">评论</option>
                    <option value="IMAGE">图片</option>
                    <option value="OTHER">其他</option>
                  </select>
                </label>
                <label>可访问状态
                  <select value={platformLinkForm.availabilityStatus} onChange={(e) => setPlatformLinkForm((prev) => ({ ...prev, availabilityStatus: e.target.value }))}>
                    <option value="AVAILABLE">可访问</option>
                    <option value="DELETED">已删除</option>
                    <option value="PRIVATE">已私密</option>
                    <option value="LOGIN_REQUIRED">需登录</option>
                    <option value="ARCHIVED_ONLY">仅存档</option>
                    <option value="UNKNOWN">未知</option>
                  </select>
                </label>
              </div>
              <label>原帖 URL<input value={platformLinkForm.originalUrl} onChange={(e) => setPlatformLinkForm((prev) => ({ ...prev, originalUrl: e.target.value }))} placeholder="https://example.com/post" /></label>
              <label>规范 URL<input value={platformLinkForm.canonicalUrl} onChange={(e) => setPlatformLinkForm((prev) => ({ ...prev, canonicalUrl: e.target.value }))} /></label>
              <label>标题<input value={platformLinkForm.title} onChange={(e) => setPlatformLinkForm((prev) => ({ ...prev, title: e.target.value }))} /></label>
              <label>说明<textarea value={platformLinkForm.description} onChange={(e) => setPlatformLinkForm((prev) => ({ ...prev, description: e.target.value }))} /></label>
              <label>作者展示名<input value={platformLinkForm.authorDisplay} onChange={(e) => setPlatformLinkForm((prev) => ({ ...prev, authorDisplay: e.target.value }))} /></label>
              <label>缩略图 URL<input value={platformLinkForm.thumbnailUrl} onChange={(e) => setPlatformLinkForm((prev) => ({ ...prev, thumbnailUrl: e.target.value }))} /></label>
              <label>存档 URL<input value={platformLinkForm.archiveUrl} onChange={(e) => setPlatformLinkForm((prev) => ({ ...prev, archiveUrl: e.target.value }))} /></label>
              <button onClick={handleCreatePlatformLink}><Link2 size={14} /> 新增外链</button>
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
  const [facets, setFacets] = useState<EventFacetsDto | null>(null);
  const [searchResults, setSearchResults] = useState<SearchResultDto[]>([]);
  const [searchTotal, setSearchTotal] = useState(0);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [searchError, setSearchError] = useState("");
  const eventRequestSeq = useRef(0);
  const searchRequestSeq = useRef(0);

  // Filters for Events Index
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTopic, setSelectedTopic] = useState<string>("");
  const [selectedStatus, setSelectedStatus] = useState<string>("");
  const [selectedPlatform, setSelectedPlatform] = useState<string>("");
  const [selectedDateFrom, setSelectedDateFrom] = useState<string>("");
  const [selectedDateTo, setSelectedDateTo] = useState<string>("");
  const [selectedSort, setSelectedSort] = useState<"updated" | "newest" | "oldest" | "sourceCount">("updated");

  useEffect(() => {
    setLoadingEvents(true);
    fetchEvents()
      .then((items) => {
        setEvents(items);
      })
      .catch((err) => setEventListError(err instanceof Error ? err.message : "事件列表加载失败"))
      .finally(() => setLoadingEvents(false));
    fetchEventFacets().then(setFacets).catch(() => setFacets(null));
  }, []);

  useEffect(() => {
    if (route.name === "events") {
      setSearchQuery(route.params.get("q") ?? "");
      setSelectedTopic(route.params.get("topic") ?? "");
      setSelectedStatus(route.params.get("status") ?? "");
      setSelectedPlatform(route.params.get("platform") ?? "");
      setSelectedDateFrom(route.params.get("dateFrom") ?? "");
      setSelectedDateTo(route.params.get("dateTo") ?? "");
      const sort = route.params.get("sort");
      setSelectedSort(sort === "newest" || sort === "oldest" || sort === "sourceCount" ? sort : "updated");
      const page = Number(route.params.get("page") ?? "1");
      setEventPage(Number.isInteger(page) && page > 0 ? page : 1);
    } else if (route.name === "search") {
      setSearchQuery(route.params.get("q") ?? "");
      const page = Number(route.params.get("page") ?? "1");
      setEventPage(Number.isInteger(page) && page > 0 ? page : 1);
    }
  }, [route]);

  useEffect(() => {
    setEventPage(1);
  }, [searchQuery, selectedTopic, selectedStatus, selectedPlatform, selectedDateFrom, selectedDateTo, selectedSort]);

  useEffect(() => {
    if (route.name !== "events" && route.name !== "search") return;
    if (route.name !== "events") return;
    const seq = ++eventRequestSeq.current;
    setLoadingEvents(true);
    setEventListError("");
    fetchEventPage({
      page: eventPage,
      pageSize: 12,
      query: searchQuery.trim() || undefined,
      topic: selectedTopic || undefined,
      eventProcessStatus: (selectedStatus as any) || undefined,
      platform: (selectedPlatform as any) || undefined,
      dateFrom: selectedDateFrom || undefined,
      dateTo: selectedDateTo || undefined,
      sort: selectedSort
    })
      .then((data) => {
        if (seq !== eventRequestSeq.current) return;
        setEventResults(data.items);
        setEventTotal(data.total);
      })
      .catch((err) => {
        if (seq === eventRequestSeq.current) setEventListError(err instanceof Error ? err.message : "事件列表加载失败");
      })
      .finally(() => {
        if (seq === eventRequestSeq.current) setLoadingEvents(false);
      });
  }, [route.name, eventPage, searchQuery, selectedTopic, selectedStatus, selectedPlatform, selectedDateFrom, selectedDateTo, selectedSort]);

  useEffect(() => {
    if (route.name !== "events") return;
    const next = new URLSearchParams();
    if (searchQuery.trim()) next.set("q", searchQuery.trim());
    if (selectedTopic) next.set("topic", selectedTopic);
    if (selectedStatus) next.set("status", selectedStatus);
    if (selectedPlatform) next.set("platform", selectedPlatform);
    if (selectedDateFrom) next.set("dateFrom", selectedDateFrom);
    if (selectedDateTo) next.set("dateTo", selectedDateTo);
    if (selectedSort !== "updated") next.set("sort", selectedSort);
    if (eventPage > 1) next.set("page", String(eventPage));
    const path = `/events${next.toString() ? `?${next}` : ""}`;
    if (`${window.location.pathname}${window.location.search}` !== path) {
      window.history.replaceState({}, "", path);
    }
  }, [route.name, eventPage, searchQuery, selectedTopic, selectedStatus, selectedPlatform, selectedDateFrom, selectedDateTo, selectedSort]);

  useEffect(() => {
    if (route.name !== "search") return;
    const query = searchQuery.trim();
    const next = new URLSearchParams();
    if (query) next.set("q", query);
    if (eventPage > 1) next.set("page", String(eventPage));
    const path = `/search${next.toString() ? `?${next}` : ""}`;
    if (`${window.location.pathname}${window.location.search}` !== path) {
      window.history.replaceState({}, "", path);
    }
    if (!query) {
      setSearchResults([]);
      setSearchTotal(0);
      return;
    }
    const seq = ++searchRequestSeq.current;
    setLoadingSearch(true);
    setSearchError("");
    searchArchive({ q: query, page: eventPage, pageSize: 12 })
      .then((data) => {
        if (seq !== searchRequestSeq.current) return;
        setSearchResults(data.items);
        setSearchTotal(data.total);
      })
      .catch((err) => {
        if (seq === searchRequestSeq.current) setSearchError(err instanceof Error ? err.message : "检索失败");
      })
      .finally(() => {
        if (seq === searchRequestSeq.current) setLoadingSearch(false);
      });
  }, [route.name, eventPage, searchQuery]);

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
	               <strong>{events.length} 卷</strong>
	               <span>在册争议事件</span>
	            </div>
	            <div className="hero-stat-item">
	              <strong>{events.reduce((sum, e) => sum + e.sourceCount, 0)} 份</strong>
	              <span>认证原始材料</span>
	            </div>
	            <div className="hero-stat-item">
	              <strong>{events.reduce((sum, e) => sum + e.platformLinkCount, 0)} 条</strong>
	              <span>存卷跳转外链</span>
	            </div>
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
	                    <button className="ranking-title" onClick={() => navigate(`/events/${event.slug}`)} style={{ fontSize: "1.15rem", fontFamily: "var(--font-serif)", fontWeight: 700, cursor: "pointer", color: "var(--text-primary)", marginBottom: "0.8rem" }}>
	                      {event.neutralTitle}
	                    </button>
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
	    const uniqueTopics = facets?.topics ?? [];

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
                    aria-label="清空搜索词"
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

            <input
              type="date"
              value={selectedDateFrom}
              onChange={(e) => setSelectedDateFrom(e.target.value)}
              aria-label="起始日期"
              style={{
                backgroundColor: "var(--bg-card)",
                border: "1px solid var(--border-color)",
                color: "var(--text-secondary)",
                borderRadius: "var(--radius-sm)",
                padding: "0.2rem 0.5rem",
                fontSize: "0.9rem",
                outline: "none"
              }}
            />

            <input
              type="date"
              value={selectedDateTo}
              onChange={(e) => setSelectedDateTo(e.target.value)}
              aria-label="结束日期"
              style={{
                backgroundColor: "var(--bg-card)",
                border: "1px solid var(--border-color)",
                color: "var(--text-secondary)",
                borderRadius: "var(--radius-sm)",
                padding: "0.2rem 0.5rem",
                fontSize: "0.9rem",
                outline: "none"
              }}
            />

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
            title={searchQuery || selectedTopic || selectedStatus || selectedPlatform || selectedDateFrom || selectedDateTo ? "筛选条件下暂无匹配档案" : "暂无公开档案"}
            body={searchQuery || selectedTopic || selectedStatus || selectedPlatform || selectedDateFrom || selectedDateTo ? "可清除部分筛选条件，或更换搜索词再次检索。" : "当前尚未发布任何公开卷宗。"}
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
    const submitSearch = () => {
      setEventPage(1);
      navigate(`/search${searchQuery.trim() ? `?q=${encodeURIComponent(searchQuery.trim())}` : ""}`);
    };
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
                submitSearch();
              }
            }}
          />
          <button onClick={submitSearch}>检索</button>
        </div>

        {searchQuery.trim() ? (
          <div className="search-results-section animate-fade">
            <h2>匹配到的公开资料 ({searchTotal})</h2>
            {searchError ? (
              <ErrorState title="检索失败" body={searchError} onRetry={() => window.location.reload()} />
            ) : loadingSearch ? (
              <LoadingState />
            ) : searchResults.length === 0 ? (
              <p style={{ color: "var(--text-tertiary)", fontSize: "0.95rem" }}>暂无匹配的公开资料。</p>
            ) : (
              <div className="search-result-list">
                {searchResults.map((result) => (
                  <article className="search-result-item" key={`${result.type}-${result.id}`}>
                    <span className="search-result-type">{searchResultTypeLabel(result.type)} / {result.matchedField}</span>
                    <button onClick={() => navigate(`/events/${result.event.slug}`)}>{result.event.neutralTitle}</button>
                    <p>{result.snippet}</p>
                    <small>{formatDate(result.updatedAt)}</small>
                  </article>
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
    const topicCategories = facets?.topics ?? [];

    pageContent = (
      <SimplePage title="议题地图" eyebrow="Topic Navigation Mapping" icon={<MapIcon size={22} />}>
        {topicCategories.length === 0 ? (
          <EmptyState title="暂无公开议题" body="发布事件后会自动生成议题地图。" />
        ) : (
          <div className="topic-grid">
          {topicCategories.map((item) => (
            <article
              className="topic-card"
              key={item.slug}
              role="link"
              tabIndex={0}
              onClick={() => {
                setSelectedTopic(item.slug);
                navigate(`/events?topic=${item.slug}`);
              }}
              onKeyDown={(eventKey) => {
                if (eventKey.key === "Enter" || eventKey.key === " ") {
                  eventKey.preventDefault();
                  setSelectedTopic(item.slug);
                  navigate(`/events?topic=${item.slug}`);
                }
              }}
            >
              <Tags size={24} />
              <h2>{item.name}</h2>
              <p>该议题下的公开档案会按资料来源、时间线和修订记录持续归档。</p>
              <span>已收录事件：{item.count} 卷</span>
            </article>
          ))}
          </div>
        )}
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
