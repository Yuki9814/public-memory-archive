import { test } from "node:test";
import assert from "node:assert";
import type { Source, SourcePlatformLink } from "@memory-archive/db";
import {
  serializeClaim,
  serializeEventSummary,
  serializePlatformLink,
  serializeSource,
  serializeTimelineEntry,
  type EventWithInclusions,
  type TimelineEntryWithSource
} from "./serializers.js";

/**
 * Local fixture helpers to centralize 'as unknown as' casts and provide defaults.
 */
function mockEvent(overrides: Record<string, unknown> = {}): EventWithInclusions {
  return {
    id: "evt_1",
    slug: "test-event",
    title: "Test Event",
    neutralTitle: "Neutral Test Event",
    summary: "A summary",
    editorialStatus: "PUBLISHED",
    eventProcessStatus: "ONGOING",
    updatedAt: new Date("2026-05-25T10:00:00Z"),
    topic: { slug: "topic-1", name: "Topic 1" },
    tags: [],
    sources: [],
    _count: { sources: 0, timelineEntries: 0 },
    ...overrides
  } as unknown as EventWithInclusions;
}

function mockPlatformLink(overrides: Record<string, unknown> = {}): SourcePlatformLink {
  return {
    id: "link_1",
    sourceId: "src_1",
    platform: "WEIBO",
    contentKind: "POST",
    originalUrl: "https://weibo.com/123",
    title: "Link Title",
    description: "Link Description",
    availabilityStatus: "AVAILABLE",
    displayOrder: 1,
    ...overrides
  } as unknown as SourcePlatformLink;
}

function mockSource(overrides: Record<string, unknown> = {}): Source {
  return {
    id: "src_1",
    title: "Source Title",
    url: "https://example.com",
    sourceType: "NEWS_REPORT",
    reliabilityLevel: "HIGH",
    summary: "Source summary",
    ...overrides
  } as unknown as Source;
}

function mockTimelineEntry(overrides: Record<string, unknown> = {}): TimelineEntryWithSource {
  return {
    id: "te_1",
    title: "Entry Title",
    body: "Entry Body",
    happenedAt: new Date("2026-05-25T08:00:00Z"),
    sourceId: "src_1",
    source: { title: "Source Title", reliabilityLevel: "HIGH" },
    sortOrder: 0,
    ...overrides
  } as unknown as TimelineEntryWithSource;
}

function mockClaim(overrides: Record<string, unknown> = {}): Parameters<typeof serializeClaim>[0] {
  return {
    id: "claim_1",
    title: "Claim Title",
    statement: "Claim statement",
    status: "OPEN",
    importance: "MEDIUM",
    claimantActor: null,
    evidenceLinks: [
      {
        id: "link_1",
        relationType: "SUPPORTS",
        notes: null,
        evidence: {
          id: "evidence_1",
          title: "Evidence Title",
          description: "Evidence description",
          evidenceKind: "OTHER",
          reliabilityLevel: "HIGH",
          sourceId: null,
          source: null,
          storageUrl: null,
          externalUrl: null,
          capturedAt: new Date("2026-05-25T08:00:00Z")
        }
      }
    ],
    ...overrides
  } as unknown as Parameters<typeof serializeClaim>[0];
}

test("serializeEventSummary handles basic event", () => {
  const event = mockEvent({
    tags: [{ tag: { id: "tag_1", slug: "tag-1", label: "Tag 1" } }]
  });

  const result = serializeEventSummary(event, 0);

  assert.strictEqual(result.id, "evt_1");
  assert.strictEqual(result.slug, "test-event");
  assert.strictEqual(result.topic?.slug, "topic-1");
  assert.strictEqual(result.tags[0].slug, "tag-1");
  assert.strictEqual(result.discussionMetrics?.sourceCount, 0);
});

test("serializePlatformLink handles basic link", () => {
  const link = mockPlatformLink({});
  const result = serializePlatformLink(link);
  assert.strictEqual(result.id, "link_1");
  assert.strictEqual(result.platform, "WEIBO");
});

test("serializeSource handles basic source", () => {
  const source = mockSource({ reliabilityLevel: "HIGH" });
  const result = serializeSource(source);
  assert.strictEqual(result.id, "src_1");
  assert.strictEqual(result.reliabilityLevel, "HIGH");
});

test("serializeTimelineEntry handles basic entry", () => {
  const entry = mockTimelineEntry({});
  const result = serializeTimelineEntry(entry);
  assert.strictEqual(result.id, "te_1");
  assert.strictEqual(result.sourceTitle, "Source Title");
  assert.strictEqual(result.reliabilityLevel, "HIGH");
});

test("serializeEventSummary falls back instead of throwing for invalid updatedAt values", () => {
  for (const updatedAt of ["not-a-valid-date", new Date(NaN)]) {
    const result = serializeEventSummary(mockEvent({ updatedAt }), 0);

    assert.strictEqual(Number.isFinite(Date.parse(result.updatedAt)), true);
    assert.ok(result.discussionMetrics);
    assert.strictEqual(Number.isFinite(Date.parse(result.discussionMetrics.latestUpdateAt)), true);
  }
});

test("optional serializer dates become null when date input is invalid", () => {
  const link = mockPlatformLink({ publishedAt: "invalid-date", capturedAt: new Date(NaN) });
  const serializedLink = serializePlatformLink(link);

  assert.strictEqual(serializedLink.publishedAt, null);
  assert.strictEqual(serializedLink.capturedAt, null);

  const source = mockSource({ publishedAt: "also-invalid" });
  assert.strictEqual(serializeSource(source).publishedAt, null);
});

test("timeline and claim serializers handle invalid nested dates without throwing", () => {
  const timelineEntry = mockTimelineEntry({ happenedAt: "2026-99-99T00:00:00Z" });
  const serializedEntry = serializeTimelineEntry(timelineEntry);

  assert.strictEqual(Number.isFinite(Date.parse(serializedEntry.happenedAt)), true);

  const claim = mockClaim({
    evidenceLinks: [
      {
        id: "link_1",
        relationType: "SUPPORTS",
        notes: null,
        evidence: {
          id: "evidence_1",
          title: "Evidence Title",
          description: "Evidence description",
          evidenceKind: "OTHER",
          reliabilityLevel: "HIGH",
          sourceId: null,
          source: null,
          storageUrl: null,
          externalUrl: null,
          capturedAt: "totally-invalid"
        }
      }
    ]
  });

  assert.strictEqual(serializeClaim(claim).evidenceLinks[0].evidence.capturedAt, null);
});
