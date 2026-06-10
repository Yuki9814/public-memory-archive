import type {
  ClaimDto,
  CoverImageDto,
  DiscussionMetricsDto,
  EventDetailDto,
  EventListItemDto,
  PlatformLinkDto,
  SourceDto,
  TimelineEntryDto
} from "@memory-archive/shared";
import { getEventProcessStatusLabel } from "@memory-archive/shared";
import type {
  Event,
  Source,
  SourcePlatformLink,
  TimelineEntry,
  Topic,
  Tag,
  EventTag,
  ArchiveCapture,
  Claim,
  EvidenceItem,
  ClaimEvidenceLink,
  Actor
} from "@memory-archive/db";

export type EventWithInclusions = Event & {
  topic?: Topic | null;
  tags?: (EventTag & { tag: Tag })[];
  sources?: (Source & {
    platformLinks?: SourcePlatformLink[];
    captures?: ArchiveCapture[];
  })[];
  _count?: {
    sources?: number;
    timelineEntries?: number;
  };
  timelineEntries?: TimelineEntry[];
};

type ClaimWithInclusions = Claim & {
  claimantActor?: Actor | null;
  evidenceLinks?: (ClaimEvidenceLink & {
    evidence: EvidenceItem & {
      source?: Source | null;
    };
  })[];
};

export type TimelineEntryWithSource = TimelineEntry & {
  source?: Source | null;
};

type SourceWithCaptures = Source & {
  captures?: ArchiveCapture[];
};

function iso(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function jsonArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function discussionStage(status: string): string {
  return getEventProcessStatusLabel(status);
}

function includedSources(event: EventWithInclusions): (Source & {
  platformLinks?: SourcePlatformLink[];
  captures?: ArchiveCapture[];
})[] {
  return Array.isArray(event.sources) ? event.sources : [];
}

function buildCoverImage(event: EventWithInclusions): CoverImageDto | undefined {
  for (const source of includedSources(event)) {
    for (const link of source.platformLinks ?? []) {
      if (!link.thumbnailUrl || !link.originalUrl) continue;
      return {
        url: link.thumbnailUrl,
        alt: `原始资料缩略图：${link.title}`,
        sourceUrl: link.originalUrl,
        sourceTitle: link.title,
        credit: link.authorDisplay ?? source.publisher ?? link.platform ?? null,
        verifiedAt: iso(link.capturedAt ?? link.updatedAt),
        status: "VERIFIED_SOURCE_IMAGE"
      };
    }
  }

  for (const source of includedSources(event)) {
    for (const capture of source.captures ?? []) {
      if (capture.captureStatus !== "SUCCEEDED" || !capture.screenshotUrl) continue;
      return {
        url: capture.screenshotUrl,
        alt: `存档截图：${source.title}`,
        sourceUrl: capture.finalUrl ?? capture.originalUrl ?? source.url,
        sourceTitle: source.title,
        credit: source.publisher ?? source.authorDisplay ?? null,
        verifiedAt: iso(capture.capturedAt ?? capture.updatedAt),
        status: "ARCHIVE_SCREENSHOT"
      };
    }
  }

  return undefined;
}

function buildDiscussionMetrics(event: EventWithInclusions, platformLinkCount = 0): DiscussionMetricsDto {
  const sources = includedSources(event);
  const platforms = new Set<string>();
  for (const source of sources) {
    for (const link of source.platformLinks ?? []) {
      if (link.platform) platforms.add(link.platform);
    }
  }

  return {
    sourceCount: event._count?.sources ?? sources.length ?? 0,
    platformCount: platforms.size > 0 ? platforms.size : platformLinkCount,
    timelineCount: event._count?.timelineEntries ?? event.timelineEntries?.length ?? 0,
    latestUpdateAt: iso(event.updatedAt) ?? new Date().toISOString(),
    discussionStage: discussionStage(event.eventProcessStatus)
  };
}

export function serializeEventSummary(event: EventWithInclusions, platformLinkCount = 0): EventListItemDto {
  return {
    id: event.id,
    slug: event.slug,
    title: event.title,
    neutralTitle: event.neutralTitle,
    summary: event.summary,
    editorialStatus: event.editorialStatus as any,
    eventProcessStatus: event.eventProcessStatus as any,
    updatedAt: iso(event.updatedAt) ?? new Date().toISOString(),
    topic: event.topic ? { slug: event.topic.slug, name: event.topic.name } : null,
    tags: (event.tags ?? []).map((entry) => ({
      id: entry.tag.id,
      slug: entry.tag.slug,
      label: entry.tag.label
    })),
    sourceCount: event._count?.sources ?? 0,
    timelineCount: event._count?.timelineEntries ?? 0,
    platformLinkCount,
    coverImage: buildCoverImage(event),
    discussionMetrics: buildDiscussionMetrics(event, platformLinkCount)
  };
}

export function serializeEventDetail(event: EventWithInclusions, platformLinkCount = 0): EventDetailDto {
  return {
    ...serializeEventSummary(event, platformLinkCount),
    whatWeKnow: jsonArray(event.whatWeKnow),
    whatIsDisputed: jsonArray(event.whatIsDisputed),
    whatNotToInfer: jsonArray(event.whatNotToInfer),
    latestUpdates: jsonArray(event.latestUpdates),
    correctionEnabled: event.correctionEnabled,
    reportEnabled: event.reportEnabled
  };
}

export function serializePlatformLink(link: SourcePlatformLink): PlatformLinkDto {
  return {
    id: link.id,
    sourceId: link.sourceId!,
    platform: link.platform as any,
    contentKind: link.contentKind as any,
    originalUrl: link.originalUrl,
    canonicalUrl: link.canonicalUrl,
    title: link.title,
    description: link.description,
    authorDisplay: link.authorDisplay,
    thumbnailUrl: link.thumbnailUrl,
    publishedAt: iso(link.publishedAt),
    capturedAt: iso(link.capturedAt),
    availabilityStatus: link.availabilityStatus as any,
    engagementSnapshot: link.engagementSnapshot as any,
    displayOrder: link.displayOrder,
    archiveUrl: link.archiveUrl
  };
}

export function serializeTimelineEntry(entry: TimelineEntryWithSource): TimelineEntryDto {
  return {
    id: entry.id,
    title: entry.title,
    body: entry.body,
    happenedAt: iso(entry.happenedAt) ?? new Date().toISOString(),
    sourceId: entry.sourceId,
    sourceTitle: entry.source?.title ?? null,
    reliabilityLevel: entry.source?.reliabilityLevel as any ?? null,
    sortOrder: entry.sortOrder
  };
}

export function serializeSource(source: SourceWithCaptures): SourceDto {
  const latestCapture = source.captures?.[0];
  return {
    id: source.id,
    title: source.title,
    url: source.url,
    sourceType: source.sourceType,
    reliabilityLevel: source.reliabilityLevel as any,
    publisher: source.publisher,
    authorDisplay: source.authorDisplay,
    publishedAt: iso(source.publishedAt),
    summary: source.summary,
    latestCaptureStatus: latestCapture?.captureStatus ?? null,
    latestCaptureAt: iso(latestCapture?.capturedAt ?? latestCapture?.updatedAt),
    latestCaptureError: latestCapture?.errorMessage ?? null,
    latestCaptureHash: latestCapture?.contentHash ?? null,
    latestCaptureFinalUrl: latestCapture?.finalUrl ?? null,
    latestCaptureArchiveUrl: latestCapture?.waybackUrl ?? latestCapture?.htmlSnapshotUrl ?? null
  };
}

export function serializeClaim(claim: ClaimWithInclusions): ClaimDto {
  return {
    id: claim.id,
    title: claim.title,
    statement: claim.statement,
    status: claim.status as any,
    importance: claim.importance as any,
    claimantActorDisplay: claim.claimantActor?.displayName ?? null,
    evidenceLinks: (claim.evidenceLinks ?? []).map((link) => ({
      id: link.id,
      relationType: link.relationType as any,
      notes: link.notes,
      evidence: {
        id: link.evidence.id,
        title: link.evidence.title,
        description: link.evidence.description,
        evidenceKind: link.evidence.evidenceKind,
        reliabilityLevel: link.evidence.reliabilityLevel as any,
        sourceId: link.evidence.sourceId,
        sourceTitle: link.evidence.source?.title ?? null,
        storageUrl: link.evidence.storageUrl,
        externalUrl: link.evidence.externalUrl,
        capturedAt: iso(link.evidence.capturedAt)
      }
    }))
  };
}
