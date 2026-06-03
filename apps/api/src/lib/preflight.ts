import type { FailedCheck } from "@memory-archive/shared";
import {
  containsSensitivePersonalInfo,
  describeSensitiveHits,
  findIncitingTerms
} from "@memory-archive/shared";
import type {
  Event,
  Source,
  SourcePlatformLink,
  TimelineEntry,
  Claim,
  ClaimEvidenceLink,
  EvidenceItem,
  Actor,
  EventActor,
  EventVersion
} from "@memory-archive/db";

const socialPlatforms = new Set(["BILIBILI", "XIAOHONGSHU", "WEIBO"]);

export type PreflightEvent = Event & {
  sources?: (Source & { platformLinks?: SourcePlatformLink[] })[];
  timelineEntries?: TimelineEntry[];
  claims?: (Claim & { evidenceLinks?: ClaimEvidenceLink[] })[];
  evidenceItems?: EvidenceItem[];
  eventActors?: (EventActor & { actor?: Actor | null })[];
  eventVersions?: EventVersion[];
};

function textOf(value: unknown) {
  if (Array.isArray(value)) return value.join("\n");
  if (typeof value === "string") return value;
  return "";
}

function checkBasicInfo(event: PreflightEvent, failed: FailedCheck[]) {
  if (!event.neutralTitle?.trim()) {
    failed.push({
      code: "NEUTRAL_TITLE_REQUIRED",
      message: "neutral_title is required.",
      path: "event.neutralTitle"
    });
  }

  const inciting = [...findIncitingTerms(event.title ?? ""), ...findIncitingTerms(event.neutralTitle ?? "")];
  if (inciting.length > 0) {
    failed.push({
      code: "INCITING_TITLE",
      message: `Title contains inciting or mobilizing terms: ${[...new Set(inciting)].join(", ")}.`,
      path: "event.title"
    });
  }

  if (!event.summary?.trim()) {
    failed.push({
      code: "SUMMARY_REQUIRED",
      message: "summary is required.",
      path: "event.summary"
    });
  }
}

function checkSourcesAndTimeline(event: PreflightEvent, failed: FailedCheck[]) {
  if (!event.sources?.length) {
    failed.push({
      code: "SOURCE_REQUIRED",
      message: "At least one source is required.",
      path: "sources"
    });
  }

  if (!event.timelineEntries?.some((entry) => entry.sourceId)) {
    failed.push({
      code: "TIMELINE_SOURCE_REQUIRED",
      message: "At least one timeline entry must be bound to source_id.",
      path: "timelineEntries"
    });
  }

  for (const source of event.sources ?? []) {
    if (!source.reliabilityLevel || source.reliabilityLevel === "UNKNOWN") {
      failed.push({
        code: "SOURCE_RELIABILITY_REQUIRED",
        message: `Source "${source.title}" must have reliability_level.`,
        path: `sources.${source.id}.reliabilityLevel`
      });
    }

    for (const link of source.platformLinks ?? []) {
      if (socialPlatforms.has(link.platform) && !link.description?.trim()) {
        failed.push({
          code: "PLATFORM_LINK_DESCRIPTION_REQUIRED",
          message: `${link.platform} platform link "${link.title}" needs a description, not a bare URL.`,
          path: `sourcePlatformLinks.${link.id}.description`
        });
      }
    }
  }
}

function checkClaims(event: PreflightEvent, failed: FailedCheck[]) {
  for (const claim of event.claims ?? []) {
    const hasEvidence = (claim.evidenceLinks ?? []).length > 0;
    const canRemainOpen = ["UNVERIFIED", "INSUFFICIENT_EVIDENCE"].includes(claim.status);
    if (claim.importance === "KEY" && !hasEvidence && !canRemainOpen) {
      failed.push({
        code: "KEY_CLAIM_EVIDENCE_REQUIRED",
        message:
          "Key claims need linked evidence, or must be marked UNVERIFIED / INSUFFICIENT_EVIDENCE.",
        path: `claims.${claim.id}`
      });
    }
  }
}

function checkActors(event: PreflightEvent, failed: FailedCheck[]) {
  for (const eventActor of event.eventActors ?? []) {
    const actor = eventActor.actor;
    if (actor?.privacyLevel === "HIGH" && !actor.privacyNote?.trim()) {
      failed.push({
        code: "HIGH_PRIVACY_NOTE_REQUIRED",
        message: `High privacy actor "${actor.displayName}" needs privacy_note.`,
        path: `actors.${actor.id}.privacyNote`
      });
    }
    if (actor?.isMinor && actor.privacyLevel !== "HIGH" && actor.privacyLevel !== "MINOR_PROTECTED") {
      failed.push({
        code: "MINOR_HIGH_PRIVACY_REQUIRED",
        message: `Minor actor "${actor.displayName}" must use HIGH or MINOR_PROTECTED privacy_level.`,
        path: `actors.${actor.id}.privacyLevel`
      });
    }
  }
}

function checkSensitiveInfo(event: PreflightEvent, failed: FailedCheck[]) {
  const inspectText = [
    event.title,
    event.neutralTitle,
    event.summary,
    textOf(event.whatWeKnow),
    textOf(event.whatIsDisputed),
    textOf(event.whatNotToInfer),
    ...(event.sources ?? []).flatMap((source) => [
      source.title,
      source.url,
      source.publisher,
      source.authorDisplay,
      source.summary,
      ...(source.platformLinks ?? []).flatMap((link) => [
        link.title,
        link.description,
        link.authorDisplay,
        link.originalUrl,
        link.canonicalUrl,
        link.thumbnailUrl,
        link.archiveUrl
      ])
    ]),
    ...(event.timelineEntries ?? []).flatMap((entry) => [entry.title, entry.body]),
    ...(event.claims ?? []).flatMap((claim) => [claim.title, claim.statement]),
    ...(event.evidenceItems ?? []).flatMap((evidence) => [
      evidence.title,
      evidence.description,
      evidence.storageUrl,
      evidence.externalUrl
    ])
  ]
    .filter(Boolean)
    .join("\n");

  if (containsSensitivePersonalInfo(inspectText)) {
    failed.push({
      code: "SENSITIVE_PERSONAL_INFO",
      message: `Potential phone, identity number, address, or similar personal data detected: ${describeSensitiveHits(inspectText).join(", ")}.`,
      path: "event"
    });
  }
}

function checkSystemIntegrity(event: PreflightEvent, failed: FailedCheck[]) {
  if (!event.eventVersions?.length) {
    failed.push({
      code: "VERSION_SNAPSHOT_REQUIRED",
      message: "At least one event_versions snapshot is required before publish.",
      path: "eventVersions"
    });
  }

  if (!event.correctionEnabled) {
    failed.push({
      code: "CORRECTION_ENTRY_REQUIRED",
      message: "Correction entry must remain open.",
      path: "event.correctionEnabled"
    });
  }

  if (!event.reportEnabled) {
    failed.push({
      code: "REPORT_ENTRY_REQUIRED",
      message: "Report entry must remain open.",
      path: "event.reportEnabled"
    });
  }
}

export function runPublishPreflight(event: PreflightEvent): FailedCheck[] {
  const failed: FailedCheck[] = [];

  checkBasicInfo(event, failed);
  checkSourcesAndTimeline(event, failed);
  checkClaims(event, failed);
  checkActors(event, failed);
  checkSensitiveInfo(event, failed);
  checkSystemIntegrity(event, failed);

  return failed;
}
