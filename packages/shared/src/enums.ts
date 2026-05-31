export const editorialStatuses = [
  "DRAFT",
  "PENDING_REVIEW",
  "PUBLISHED",
  "UNPUBLISHED",
  "ARCHIVED"
] as const;
export type EditorialStatus = (typeof editorialStatuses)[number];

export const eventProcessStatuses = [
  "UNVERIFIED",
  "DEVELOPING",
  "PLATFORM_INTERVENED",
  "OFFICIAL_INVESTIGATION",
  "LEGAL_PROCESS",
  "CONCLUDED"
] as const;
export type EventProcessStatus = (typeof eventProcessStatuses)[number];

export const platforms = [
  "BILIBILI",
  "XIAOHONGSHU",
  "WEIBO",
  "DOUYIN",
  "ZHIHU",
  "OTHER"
] as const;
export type Platform = (typeof platforms)[number];

export const contentKinds = [
  "VIDEO",
  "NOTE",
  "POST",
  "ARTICLE",
  "COMMENT",
  "IMAGE",
  "OTHER"
] as const;
export type ContentKind = (typeof contentKinds)[number];

export const availabilityStatuses = [
  "AVAILABLE",
  "DELETED",
  "PRIVATE",
  "LOGIN_REQUIRED",
  "UNKNOWN",
  "ARCHIVED_ONLY"
] as const;
export type AvailabilityStatus = (typeof availabilityStatuses)[number];

export const reliabilityLevels = [
  "A_STRONG",
  "B_DIRECT",
  "C_INDIRECT",
  "D_WEAK",
  "UNKNOWN"
] as const;
export type ReliabilityLevel = (typeof reliabilityLevels)[number];

export const claimStatuses = [
  "UNVERIFIED",
  "INSUFFICIENT_EVIDENCE",
  "DISPUTED",
  "PARTIALLY_SUPPORTED",
  "SUPPORTED",
  "REFUTED"
] as const;
export type ClaimStatus = (typeof claimStatuses)[number];

export const claimImportanceLevels = ["KEY", "CONTEXT", "LOW"] as const;
export type ClaimImportance = (typeof claimImportanceLevels)[number];

export const relationTypes = [
  "SUPPORTS",
  "OPPOSES",
  "NEUTRAL",
  "COMPLICATES"
] as const;
export type RelationType = (typeof relationTypes)[number];

export const privacyLevels = [
  "PUBLIC",
  "PSEUDONYMIZED",
  "HIGH",
  "MINOR_PROTECTED"
] as const;
export type PrivacyLevel = (typeof privacyLevels)[number];

export const taskStatuses = [
  "QUEUED",
  "ACTIVE",
  "COMPLETED",
  "FAILED",
  "CANCELED"
] as const;
export type TaskStatus = (typeof taskStatuses)[number];

// --- Display labels (canonical source for API serializers + Web UI consistency) ---
// These ensure neutral, consistent terminology across the product surface.
export const eventProcessStatusLabels = {
  UNVERIFIED: "材料收集中",
  DEVELOPING: "讨论扩散中",
  PLATFORM_INTERVENED: "平台回应后",
  OFFICIAL_INVESTIGATION: "机构核验中",
  LEGAL_PROCESS: "程序推进中",
  CONCLUDED: "阶段性收束"
} as const;

export function getEventProcessStatusLabel(status: EventProcessStatus | string): string {
  if (status && status in eventProcessStatusLabels) {
    return eventProcessStatusLabels[status as EventProcessStatus];
  }
  return typeof status === "string" ? status : "材料收集中";
}

export const reliabilityLabels = {
  A_STRONG: "A 强证据",
  B_DIRECT: "B 直接材料",
  C_INDIRECT: "C 间接材料",
  D_WEAK: "D 弱线索",
  UNKNOWN: "未定级"
} as const;

export function getReliabilityLabel(level: ReliabilityLevel | string | null | undefined): string {
  const key = (level ?? "UNKNOWN") as ReliabilityLevel;
  if (key in reliabilityLabels) {
    return reliabilityLabels[key];
  }
  return typeof level === "string" ? level : "未定级";
}

// --- Additional const arrays for stricter Zod validation (prevents enum drift) ---
export const sourceTypes = [
  "ORIGINAL_POST",
  "RESPONSE",
  "OFFICIAL_NOTICE",
  "MEDIA_REPORT",
  "VIDEO",
  "NOTE",
  "SCREENSHOT",
  "DOCUMENT",
  "OTHER"
] as const;
export type SourceType = (typeof sourceTypes)[number];

export const evidenceKinds = [
  "DOCUMENT",
  "SCREENSHOT",
  "VIDEO",
  "AUDIO",
  "POST",
  "COMMENT",
  "ARTICLE",
  "ARCHIVE_CAPTURE",
  "OTHER"
] as const;
export type EvidenceKind = (typeof evidenceKinds)[number];

export const reportTypes = [
  "PRIVACY_LEAK",
  "DOXXING",
  "DEFAMATION_RISK",
  "MINOR_INFO",
  "HARASSMENT",
  "COPYRIGHT",
  "OTHER"
] as const;
export type ReportType = (typeof reportTypes)[number];

export const reportStatuses = ["PENDING", "TRIAGED", "RESOLVED", "REJECTED"] as const;
export type ReportStatus = (typeof reportStatuses)[number];

export const correctionStatuses = ["PENDING", "ACCEPTED", "REJECTED", "RESOLVED"] as const;
export type CorrectionStatus = (typeof correctionStatuses)[number];

export const submissionStatuses = ["PENDING", "REVIEWED", "ACCEPTED", "REJECTED"] as const;
export type SubmissionStatus = (typeof submissionStatuses)[number];
