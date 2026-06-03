import type {
  AvailabilityStatus,
  ClaimImportance,
  ClaimStatus,
  ContentKind,
  EditorialStatus,
  EventProcessStatus,
  Platform,
  RelationType,
  ReliabilityLevel,
  ReportStatus,
  SubmissionStatus,
  CorrectionStatus
} from "./enums.js";

export interface TagDto {
  id: string;
  slug: string;
  label: string;
}

export interface CoverImageDto {
  url: string;
  alt: string;
  sourceUrl: string;
  sourceTitle: string;
  credit?: string | null;
  verifiedAt?: string | null;
  status: "VERIFIED_SOURCE_IMAGE" | "ARCHIVE_SCREENSHOT";
}

export interface DiscussionMetricsDto {
  sourceCount: number;
  platformCount: number;
  timelineCount: number;
  latestUpdateAt: string;
  discussionStage: string;
}

export type SessionDto =
  | { role: "GUEST" }
  | { role: "ADMIN"; displayName: string; userId?: string; csrfToken: string };

export interface EventListItemDto {
  id: string;
  slug: string;
  title: string;
  neutralTitle: string;
  summary: string;
  editorialStatus: EditorialStatus;
  eventProcessStatus: EventProcessStatus;
  updatedAt: string;
  topic?: { slug: string; name: string } | null;
  tags: TagDto[];
  sourceCount: number;
  timelineCount: number;
  platformLinkCount: number;
  coverImage?: CoverImageDto;
  discussionMetrics?: DiscussionMetricsDto;
}

export interface EventDetailDto extends EventListItemDto {
  whatWeKnow: string[];
  whatIsDisputed: string[];
  whatNotToInfer: string[];
  latestUpdates: string[];
  correctionEnabled: boolean;
  reportEnabled: boolean;
}

export interface PlatformLinkDto {
  id: string;
  sourceId: string;
  platform: Platform;
  contentKind: ContentKind;
  originalUrl: string;
  canonicalUrl?: string | null;
  title: string;
  description: string;
  authorDisplay?: string | null;
  thumbnailUrl?: string | null;
  publishedAt?: string | null;
  capturedAt?: string | null;
  availabilityStatus: AvailabilityStatus;
  engagementSnapshot?: Record<string, unknown> | null;
  displayOrder: number;
  archiveUrl?: string | null;
}

export interface TimelineEntryDto {
  id: string;
  title: string;
  body: string;
  happenedAt: string;
  sourceId?: string | null;
  sourceTitle?: string | null;
  reliabilityLevel?: ReliabilityLevel | null;
  sortOrder: number;
}

export interface EvidenceItemDto {
  id: string;
  title: string;
  description: string;
  evidenceKind: string;
  reliabilityLevel: ReliabilityLevel;
  sourceId?: string | null;
  sourceTitle?: string | null;
  storageUrl?: string | null;
  externalUrl?: string | null;
  capturedAt?: string | null;
}

export interface ClaimEvidenceLinkDto {
  id: string;
  relationType: RelationType;
  notes?: string | null;
  evidence: EvidenceItemDto;
}

export interface ClaimDto {
  id: string;
  title: string;
  statement: string;
  status: ClaimStatus;
  importance: ClaimImportance;
  claimantActorDisplay?: string | null;
  evidenceLinks: ClaimEvidenceLinkDto[];
}

export interface SourceDto {
  id: string;
  title: string;
  url?: string | null;
  sourceType: string;
  reliabilityLevel: ReliabilityLevel;
  publisher?: string | null;
  authorDisplay?: string | null;
  publishedAt?: string | null;
  summary: string;
}

export interface RevisionDto {
  id: string;
  versionNumber: number;
  changeSummary: string;
  createdAt: string;
}

export interface FailedCheck {
  code: string;
  message: string;
  path?: string;
}

export type SearchResultType = "event" | "source" | "claim" | "revision";

export interface SearchResultDto {
  id: string;
  type: SearchResultType;
  matchedField: string;
  snippet: string;
  updatedAt: string;
  event: EventListItemDto;
}

export interface EventFacetsDto {
  topics: Array<{ slug: string; name: string; count: number }>;
  tags: Array<{ slug: string; label: string; count: number }>;
  platforms: Array<{ platform: Platform; count: number }>;
  statuses: Array<{ status: EventProcessStatus; label: string; count: number }>;
}

export type FeedbackKind = "submission" | "correction" | "report";

export interface FeedbackStatusDto {
  id: string;
  kind: FeedbackKind;
  status: SubmissionStatus | CorrectionStatus | ReportStatus;
  createdAt: string;
  updatedAt: string;
  priority?: number;
  priorityLabel?: "urgent" | "normal";
}

export interface Paginated<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}
