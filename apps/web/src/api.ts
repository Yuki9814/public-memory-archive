import type {
  ClaimDto,
  EventDetailDto,
  EventListItemDto,
  FailedCheck,
  Paginated,
  PlatformLinkDto,
  RevisionDto,
  RevisionDiffDto,
  SourceDto,
  TimelineEntryDto,
  SessionDto,
  EventProcessStatus,
  Platform,
  ReportType,
  ReportStatus,
  SubmissionStatus,
  CorrectionStatus,
  EditorialStatus,
  SearchResultDto,
  EventFacetsDto,
  FeedbackStatusDto,
  SourceType,
  ReliabilityLevel,
  ContentKind,
  AvailabilityStatus
} from "@memory-archive/shared";
import {
  mockClaims,
  mockDetails,
  mockEvents,
  mockPlatformLinks,
  mockSources,
  mockTimeline,
  mockVersions
} from "./mock.js";
import { normalizeApiBase } from "./normalize-api-base.js";

const apiBase = normalizeApiBase(import.meta.env.VITE_API_URL);
const allowMockFallback = import.meta.env.DEV;
let csrfToken: string | undefined;

export class ApiRequestError extends Error {
  status: number;
  payload: unknown;

  constructor(message: string, status: number, payload: unknown) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
    this.payload = payload;
  }
}

type EventQuery = {
  page?: number;
  pageSize?: number;
  query?: string;
  topic?: string;
  tag?: string;
  eventProcessStatus?: EventProcessStatus | "";
  platform?: Platform | "";
  dateFrom?: string;
  dateTo?: string;
  sort?: "newest" | "oldest" | "updated" | "sourceCount";
};

type SearchQuery = {
  q: string;
  page?: number;
  pageSize?: number;
  type?: SearchResultDto["type"];
};

export type PublicSubmitKind = "submission" | "correction" | "report";

export type SubmitReceipt = {
  id: string;
  status: SubmissionStatus | CorrectionStatus | ReportStatus;
};

export type AdminEventDto = EventListItemDto;

export type AdminSourceDto = SourceDto;

export type AdminReportDto = {
  id: string;
  eventId?: string | null;
  sourceId?: string | null;
  platformLinkId?: string | null;
  reportType: ReportType;
  reporterEmail?: string | null;
  body: string;
  status: ReportStatus;
  priority: number;
  resolutionNotes?: string | null;
  resolvedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  event?: { id: string; neutralTitle: string; slug: string } | null;
  source?: { id: string; title: string } | null;
  platformLink?: { id: string; title: string; originalUrl: string } | null;
};

export type AdminSubmissionDto = {
  id: string;
  eventId?: string | null;
  email?: string | null;
  title: string;
  body: string;
  sourceUrl?: string | null;
  status: SubmissionStatus;
  resolutionNotes?: string | null;
  resolutionAction?: string | null;
  linkedEntityType?: string | null;
  linkedEntityId?: string | null;
  resolvedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  event?: { id: string; neutralTitle: string; slug: string } | null;
};

export type AdminCorrectionDto = {
  id: string;
  eventId?: string | null;
  sourceId?: string | null;
  email?: string | null;
  title: string;
  body: string;
  status: CorrectionStatus;
  resolutionNotes?: string | null;
  resolutionAction?: string | null;
  linkedEntityType?: string | null;
  linkedEntityId?: string | null;
  resolvedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  event?: { id: string; neutralTitle: string; slug: string } | null;
  source?: { id: string; title: string } | null;
};

export type AdminTaskDto = {
  id: string;
  type: string;
  status: string;
  progress: number;
  subjectType?: string | null;
  subjectId?: string | null;
  result?: unknown;
  errorMessage?: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt?: string | null;
  captures?: Array<{
    id: string;
    originalUrl: string;
    finalUrl?: string | null;
    waybackUrl?: string | null;
    htmlSnapshotUrl?: string | null;
    contentHash?: string | null;
    captureStatus: string;
    errorMessage?: string | null;
    capturedAt?: string | null;
  }>;
};

export type AdminAuditLogDto = {
  id: string;
  userId?: string | null;
  entityType: string;
  entityId: string;
  action: string;
  before?: unknown;
  after?: unknown;
  metadata?: unknown;
  createdAt: string;
  user?: { id: string; displayName: string; role: string } | null;
};

export type PublishPreflightFailure = {
  error: "PUBLISH_PREFLIGHT_FAILED";
  failedChecks: FailedCheck[];
};

function queryString(params: Record<string, string | number | undefined>) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") query.set(key, String(value));
  }
  const value = query.toString();
  return value ? `?${value}` : "";
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const method = (init?.method ?? "GET").toUpperCase();
  const needsCsrf = ["POST", "PUT", "PATCH", "DELETE"].includes(method) && path.startsWith("/admin/");
  const response = await fetch(`${apiBase}${path}`, {
    credentials: "include",
    ...init,
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...(needsCsrf && csrfToken ? { "X-CSRF-Token": csrfToken } : {}),
      ...init?.headers
    }
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    const message =
      typeof payload === "object" && payload && "message" in payload && typeof payload.message === "string"
        ? payload.message
        : typeof payload === "object" && payload && "error" in payload && typeof payload.error === "string"
          ? payload.error
          : `Request failed: ${response.status}`;
    throw new ApiRequestError(message, response.status, payload);
  }
  return response.json() as Promise<T>;
}

async function getJson<T>(path: string): Promise<T> {
  return requestJson<T>(path);
}

function devFallback<T>(value: T, error: unknown): T {
  if (allowMockFallback) return value;
  throw error;
}

export function isDevMockFallbackEnabled() {
  return allowMockFallback;
}

export async function fetchEventPage(params: EventQuery = {}): Promise<Paginated<EventListItemDto>> {
  try {
    return await getJson<Paginated<EventListItemDto>>(
      `/api/events${queryString({
        page: params.page ?? 1,
        pageSize: params.pageSize ?? 20,
        query: params.query,
        topic: params.topic,
        tag: params.tag,
        eventProcessStatus: params.eventProcessStatus,
        platform: params.platform,
        dateFrom: params.dateFrom,
        dateTo: params.dateTo,
        sort: params.sort ?? "updated"
      })}`
    );
  } catch (error) {
    const fallbackItems = [...mockEvents];
    return devFallback(
      {
        items: fallbackItems,
        page: params.page ?? 1,
        pageSize: params.pageSize ?? fallbackItems.length,
        total: fallbackItems.length
      },
      error
    );
  }
}

export async function fetchEvents(params: EventQuery = {}): Promise<EventListItemDto[]> {
  const data = await fetchEventPage(params);
  return data.items;
}

export async function fetchEventFacets() {
  return getJson<EventFacetsDto>("/api/events/facets");
}

export async function searchArchive(params: SearchQuery) {
  return getJson<Paginated<SearchResultDto>>(
    `/api/search${queryString({
      q: params.q,
      page: params.page ?? 1,
      pageSize: params.pageSize ?? 12,
      type: params.type
    })}`
  );
}

export async function fetchFeedbackStatus(id: string) {
  return getJson<FeedbackStatusDto>(`/api/feedback/${encodeURIComponent(id)}`);
}

export async function fetchAdminEvents(params: EventQuery & { editorialStatus?: EditorialStatus | "" } = {}) {
  return getJson<Paginated<AdminEventDto>>(
    `/admin/events${queryString({
      page: params.page ?? 1,
      pageSize: params.pageSize ?? 50,
      query: params.query,
      topic: params.topic,
      tag: params.tag,
      editorialStatus: params.editorialStatus,
      eventProcessStatus: params.eventProcessStatus,
      platform: params.platform,
      dateFrom: params.dateFrom,
      dateTo: params.dateTo,
      sort: params.sort ?? "updated"
    })}`
  );
}

export async function createAdminEvent(input: {
  slug: string;
  title: string;
  neutralTitle: string;
  summary: string;
  eventProcessStatus?: EventProcessStatus;
  occurredAt?: string;
  whatWeKnow?: string[];
  whatIsDisputed?: string[];
  whatNotToInfer?: string[];
  latestUpdates?: string[];
}) {
  return requestJson<AdminEventDto>("/admin/events", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export async function updateAdminEvent(eventId: string, input: Partial<{
  title: string;
  neutralTitle: string;
  summary: string;
  eventProcessStatus: EventProcessStatus;
  occurredAt: string;
  whatWeKnow: string[];
  whatIsDisputed: string[];
  whatNotToInfer: string[];
  latestUpdates: string[];
}>) {
  return requestJson<AdminEventDto>(`/admin/events/${eventId}`, {
    method: "PATCH",
    body: JSON.stringify(input)
  });
}

export async function fetchAdminSources(eventId: string) {
  return getJson<{ items: AdminSourceDto[] }>(`/admin/events/${eventId}/sources`);
}

export async function fetchAdminTimeline(eventId: string) {
  return getJson<{ items: TimelineEntryDto[] }>(`/admin/events/${eventId}/timeline`);
}

export async function createAdminTimeline(eventId: string, input: {
  title: string;
  body: string;
  happenedAt: string;
  sourceId?: string;
  sortOrder?: number;
}) {
  return requestJson<TimelineEntryDto>(`/admin/events/${eventId}/timeline`, {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export async function fetchAdminClaims(eventId: string) {
  return getJson<{ items: ClaimDto[] }>(`/admin/events/${eventId}/claims`);
}

export async function createAdminClaim(eventId: string, input: {
  title: string;
  statement: string;
  status?: ClaimDto["status"];
  importance?: ClaimDto["importance"];
  sourceId?: string;
}) {
  return requestJson<ClaimDto>(`/admin/events/${eventId}/claims`, {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export async function fetchAdminEvidence(eventId: string) {
  return getJson<{ items: ClaimDto["evidenceLinks"][number]["evidence"][] }>(`/admin/events/${eventId}/evidence`);
}

export async function createAdminEvidence(eventId: string, input: {
  sourceId?: string;
  title: string;
  description: string;
  evidenceKind?: string;
  reliabilityLevel: ReliabilityLevel;
  storageUrl?: string;
  externalUrl?: string;
  capturedAt?: string;
}) {
  return requestJson<ClaimDto["evidenceLinks"][number]["evidence"]>(`/admin/events/${eventId}/evidence`, {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export async function createAdminClaimEvidenceLink(claimId: string, input: {
  evidenceId: string;
  relationType: "SUPPORTS" | "OPPOSES" | "NEUTRAL" | "COMPLICATES";
  notes?: string;
}) {
  return requestJson<ClaimDto["evidenceLinks"][number]>(`/admin/claims/${claimId}/evidence-links`, {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export async function createAdminSource(eventId: string, input: {
  title: string;
  url?: string;
  sourceType: SourceType;
  reliabilityLevel: ReliabilityLevel;
  publisher?: string;
  authorDisplay?: string;
  publishedAt?: string;
  summary: string;
}) {
  return requestJson<AdminSourceDto>(`/admin/events/${eventId}/sources`, {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export async function createAdminPlatformLink(eventId: string, input: {
  sourceId?: string;
  platform: Platform;
  contentKind: ContentKind;
  originalUrl: string;
  canonicalUrl?: string;
  title: string;
  description: string;
  authorDisplay?: string;
  thumbnailUrl?: string;
  publishedAt?: string;
  availabilityStatus?: AvailabilityStatus;
  archiveUrl?: string;
}) {
  return requestJson<PlatformLinkDto>(`/admin/events/${eventId}/platform-links`, {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export async function publishAdminEvent(eventId: string) {
  return requestJson<EventDetailDto>(`/admin/events/${eventId}/publish`, { method: "POST" });
}

export async function captureSource(sourceId: string) {
  return requestJson<{ taskId: string; queued: boolean }>(`/admin/sources/${sourceId}/capture`, {
    method: "POST"
  });
}

export async function fetchAdminTask(taskId: string) {
  return getJson<AdminTaskDto>(`/admin/tasks/${encodeURIComponent(taskId)}`);
}

export async function fetchAdminEventTasks(eventId: string) {
  return getJson<{ items: AdminTaskDto[] }>(`/admin/events/${eventId}/tasks`);
}

export async function fetchAdminAuditLogs(params: { entityType?: string; entityId?: string } = {}) {
  return getJson<AdminAuditLogDto[]>(
    `/admin/audit-logs${queryString({
      entityType: params.entityType,
      entityId: params.entityId
    })}`
  );
}

export async function fetchAdminReports() {
  return getJson<AdminReportDto[]>("/admin/reports");
}

export async function resolveAdminReport(id: string, status: "TRIAGED" | "RESOLVED" | "REJECTED", resolutionNotes: string) {
  return requestJson<AdminReportDto>(`/admin/reports/${id}/resolve`, {
    method: "POST",
    body: JSON.stringify({ status, resolutionNotes })
  });
}

export async function fetchAdminSubmissions() {
  return getJson<AdminSubmissionDto[]>("/admin/submissions");
}

export async function resolveAdminSubmission(id: string, input: {
  status: "REVIEWED" | "ACCEPTED" | "REJECTED";
  resolutionNotes?: string;
  resolutionAction?: string;
  linkedEntityType?: string;
  linkedEntityId?: string;
}) {
  return requestJson<AdminSubmissionDto>(`/admin/submissions/${id}/resolve`, {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export async function fetchAdminCorrections() {
  return getJson<AdminCorrectionDto[]>("/admin/corrections");
}

export async function resolveAdminCorrection(id: string, input: {
  status: "ACCEPTED" | "REJECTED" | "RESOLVED";
  resolutionNotes?: string;
  resolutionAction?: string;
  linkedEntityType?: string;
  linkedEntityId?: string;
}) {
  return requestJson<AdminCorrectionDto>(`/admin/corrections/${id}/resolve`, {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export async function createSubmission(input: {
  eventId?: string;
  email?: string;
  title: string;
  body: string;
  sourceUrl?: string;
}) {
  return requestJson<SubmitReceipt>("/api/submissions", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export async function createCorrection(input: {
  eventId?: string;
  sourceId?: string;
  email?: string;
  title: string;
  body: string;
}) {
  return requestJson<SubmitReceipt>("/api/corrections", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export async function createReport(input: {
  eventId?: string;
  sourceId?: string;
  platformLinkId?: string;
  reportType: ReportType;
  reporterEmail?: string;
  body: string;
}) {
  return requestJson<SubmitReceipt>("/api/reports", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export function failedChecksFromError(error: unknown): FailedCheck[] {
  if (error instanceof ApiRequestError) {
    const payload = error.payload as Partial<PublishPreflightFailure>;
    if (payload?.error === "PUBLISH_PREFLIGHT_FAILED" && Array.isArray(payload.failedChecks)) {
      return payload.failedChecks;
    }
  }
  return [];
}

export async function fetchEventDetail(slug: string): Promise<EventDetailDto | null> {
  try {
    return await getJson<EventDetailDto>(`/api/events/${slug}`);
  } catch (error) {
    return devFallback(mockDetails[slug] ?? null, error);
  }
}

export async function fetchPlatformLinks(slug: string): Promise<PlatformLinkDto[]> {
  try {
    const data = await getJson<{ items: PlatformLinkDto[] }>(`/api/events/${slug}/platform-links`);
    return data.items;
  } catch (error) {
    return devFallback(mockPlatformLinks[slug] ?? [], error);
  }
}

export async function fetchTimeline(slug: string): Promise<TimelineEntryDto[]> {
  try {
    const data = await getJson<{ items: TimelineEntryDto[] }>(`/api/events/${slug}/timeline?pageSize=50`);
    return data.items;
  } catch (error) {
    return devFallback(mockTimeline[slug] ?? [], error);
  }
}

export async function fetchClaims(slug: string): Promise<ClaimDto[]> {
  try {
    const data = await getJson<{ items: ClaimDto[] }>(`/api/events/${slug}/claims`);
    return data.items;
  } catch (error) {
    return devFallback(mockClaims[slug] ?? [], error);
  }
}

export async function fetchSources(slug: string): Promise<SourceDto[]> {
  try {
    const data = await getJson<{ items: SourceDto[] }>(`/api/events/${slug}/sources?pageSize=50`);
    return data.items;
  } catch (error) {
    return devFallback(mockSources[slug] ?? [], error);
  }
}

export async function fetchVersions(slug: string): Promise<RevisionDto[]> {
  try {
    const data = await getJson<{ items: RevisionDto[] }>(`/api/events/${slug}/versions`);
    return data.items;
  } catch (error) {
    return devFallback(mockVersions[slug] ?? [], error);
  }
}

export async function fetchRevisionDiff(slug: string, versionId: string): Promise<RevisionDiffDto> {
  return getJson<RevisionDiffDto>(
    `/api/events/${encodeURIComponent(slug)}/versions/${encodeURIComponent(versionId)}/diff`
  );
}

export async function fetchSession(): Promise<SessionDto> {
  try {
    const session = await getJson<SessionDto>("/api/session");
    csrfToken = session.role === "ADMIN" ? session.csrfToken : undefined;
    return session;
  } catch {
    csrfToken = undefined;
    return { role: "GUEST" };
  }
}

export async function loginAdmin(passcode: string): Promise<SessionDto> {
  const response = await fetch(`${apiBase}/api/auth/admin-login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ passcode })
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || "Login failed");
  }
  const session = (await response.json()) as SessionDto;
  csrfToken = session.role === "ADMIN" ? session.csrfToken : undefined;
  return session;
}

export async function logoutAdmin(): Promise<SessionDto> {
  const response = await fetch(`${apiBase}/api/auth/logout`, {
    method: "POST",
    credentials: "include"
  });
  if (!response.ok) {
    throw new Error("Logout failed");
  }
  csrfToken = undefined;
  return response.json() as Promise<SessionDto>;
}
