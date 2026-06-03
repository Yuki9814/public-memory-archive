import { z } from "zod";
import {
  availabilityStatuses,
  claimImportanceLevels,
  claimStatuses,
  contentKinds,
  editorialStatuses,
  eventProcessStatuses,
  platforms,
  reliabilityLevels,
  relationTypes,
  reportTypes,
  sourceTypes,
  evidenceKinds
} from "./enums.js";

export const httpUrlSchema = z.string().url().refine((value) => {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}, {
  message: "URL must use http or https protocol"
});

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20)
});

export const eventListQuerySchema = paginationQuerySchema.extend({
  query: z.string().trim().max(120).optional(),
  topic: z.string().trim().max(120).optional(),
  tag: z.string().trim().max(120).optional(),
  editorialStatus: z.enum(editorialStatuses).optional(),
  eventProcessStatus: z.enum(eventProcessStatuses).optional(),
  platform: z.enum(platforms).optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  sort: z.enum(["newest", "oldest", "updated", "sourceCount"]).default("updated")
}).refine((data) => {
  if (data.dateFrom && data.dateTo) {
    return data.dateFrom <= data.dateTo;
  }
  return true;
}, {
  message: "dateFrom must be less than or equal to dateTo",
  path: ["dateFrom"]
});

export const searchResultTypes = ["event", "source", "claim", "revision"] as const;

export const searchQuerySchema = paginationQuerySchema.extend({
  q: z.string().trim().min(1).max(120),
  type: z.enum(searchResultTypes).optional()
});

export const createEventSchema = z.object({
  slug: z.string().min(3).max(120).regex(/^[a-z0-9-]+$/),
  title: z.string().min(1).max(180),
  neutralTitle: z.string().min(1).max(180),
  summary: z.string().min(1).max(1200),
  topicId: z.string().optional(),
  eventProcessStatus: z.enum(eventProcessStatuses).optional(),
  occurredAt: z.coerce.date().optional(),
  whatWeKnow: z.array(z.string()).default([]),
  whatIsDisputed: z.array(z.string()).default([]),
  whatNotToInfer: z.array(z.string()).default([]),
  latestUpdates: z.array(z.string()).default([])
});

export const updateEventSchema = createEventSchema.partial().extend({
  editorialStatus: z.enum(editorialStatuses).optional()
});

export const createSourceSchema = z.object({
  title: z.string().min(1).max(220),
  url: httpUrlSchema.optional(),
  sourceType: z.enum(sourceTypes).default("OTHER"),
  reliabilityLevel: z.enum(reliabilityLevels),
  publisher: z.string().optional(),
  authorDisplay: z.string().optional(),
  publishedAt: z.coerce.date().optional(),
  summary: z.string().min(1).max(1200)
});

export const createPlatformLinkSchema = z.object({
  sourceId: z.string().optional(),
  platform: z.enum(platforms),
  contentKind: z.enum(contentKinds),
  originalUrl: httpUrlSchema,
  canonicalUrl: httpUrlSchema.optional(),
  title: z.string().min(1).max(220),
  description: z.string().min(20).max(600),
  authorDisplay: z.string().optional(),
  thumbnailUrl: httpUrlSchema.optional(),
  publishedAt: z.coerce.date().optional(),
  capturedAt: z.coerce.date().optional(),
  availabilityStatus: z.enum(availabilityStatuses).default("UNKNOWN"),
  engagementSnapshot: z.record(z.unknown()).optional(),
  displayOrder: z.number().int().min(0).default(0),
  archiveUrl: httpUrlSchema.optional()
});

export const createTimelineEntrySchema = z.object({
  title: z.string().min(1).max(220),
  body: z.string().min(1).max(2000),
  happenedAt: z.coerce.date(),
  sourceId: z.string().optional(),
  sortOrder: z.number().int().default(0)
});

export const createEvidenceSchema = z.object({
  sourceId: z.string().optional(),
  title: z.string().min(1).max(220),
  description: z.string().min(1).max(1200),
  evidenceKind: z.enum(evidenceKinds).default("OTHER"),
  reliabilityLevel: z.enum(reliabilityLevels),
  storageUrl: httpUrlSchema.optional(),
  externalUrl: httpUrlSchema.optional(),
  capturedAt: z.coerce.date().optional(),
  metadata: z.record(z.unknown()).optional()
});

export const createClaimSchema = z.object({
  title: z.string().min(1).max(220),
  statement: z.string().min(1).max(2000),
  status: z.enum(claimStatuses).default("UNVERIFIED"),
  importance: z.enum(claimImportanceLevels).default("CONTEXT"),
  claimantActorId: z.string().optional(),
  sourceId: z.string().optional()
});

export const createClaimEvidenceLinkSchema = z.object({
  evidenceId: z.string(),
  relationType: z.enum(relationTypes),
  notes: z.string().max(800).optional()
});

export const submissionSchema = z.object({
  eventId: z.string().optional(),
  email: z.string().email().optional(),
  title: z.string().min(1).max(220),
  body: z.string().min(1).max(4000),
  sourceUrl: httpUrlSchema.optional()
});

export const correctionSchema = z.object({
  eventId: z.string().optional(),
  sourceId: z.string().optional(),
  email: z.string().email().optional(),
  title: z.string().min(1).max(220),
  body: z.string().min(1).max(4000)
});

export const reportSchema = z.object({
  eventId: z.string().optional(),
  sourceId: z.string().optional(),
  platformLinkId: z.string().optional(),
  reportType: z.enum(reportTypes),
  reporterEmail: z.string().email().optional(),
  body: z.string().min(1).max(4000)
});
