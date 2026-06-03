import type { FastifyInstance } from "fastify";
import {
  buildRssFeed,
  correctionSchema,
  eventListQuerySchema,
  paginationQuerySchema,
  reportSchema,
  searchQuerySchema,
  submissionSchema
} from "@memory-archive/shared";
import { getEventProcessStatusLabel } from "@memory-archive/shared";
import { prisma, type Prisma } from "@memory-archive/db";
import {
  serializeClaim,
  serializeEventDetail,
  serializeEventSummary,
  serializePlatformLink,
  serializeSource,
  serializeTimelineEntry
} from "../lib/serializers.js";
import { getPublicSiteUrl } from "../lib/public-url.js";
import { getIdParam, getSlugParam } from "../lib/route-params.js";
import { clientKey, consumeBucket, hasFilledHoneypot, rejectIfLimited } from "../lib/abuse.js";

const eventSummaryInclude = {
  topic: true,
  tags: { include: { tag: true } },
  sources: {
    include: {
      platformLinks: { orderBy: [{ displayOrder: "asc" as const }, { publishedAt: "asc" as const }] },
      captures: {
        where: { captureStatus: "SUCCEEDED" as const },
        orderBy: [{ capturedAt: "desc" as const }, { createdAt: "desc" as const }]
      }
    }
  },
  _count: {
    select: {
      sources: true,
      timelineEntries: true
    }
  }
};

function textSnippet(value: string | null | undefined, query: string) {
  const text = value?.replace(/\s+/g, " ").trim() ?? "";
  if (!text) return "";
  const index = text.toLowerCase().indexOf(query.toLowerCase());
  if (index < 0) return text.slice(0, 180);
  const start = Math.max(0, index - 60);
  const end = Math.min(text.length, index + query.length + 120);
  return `${start > 0 ? "..." : ""}${text.slice(start, end)}${end < text.length ? "..." : ""}`;
}

async function serializeSearchEvent(event: Parameters<typeof serializeEventSummary>[0]) {
  const platformCount = await prisma.sourcePlatformLink.count({
    where: { source: { eventId: event.id } }
  });
  return serializeEventSummary(event, platformCount);
}

function isUnsafeFeedbackBody(requestBody: unknown) {
  return hasFilledHoneypot(requestBody);
}

async function assertPublishedFeedbackEvent(eventId: string, kind: "submission" | "correction" | "report") {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: {
      id: true,
      editorialStatus: true,
      correctionEnabled: true,
      reportEnabled: true
    }
  });
  if (!event || event.editorialStatus !== "PUBLISHED") return null;
  if (kind === "correction" && !event.correctionEnabled) return null;
  if (kind === "report" && !event.reportEnabled) return null;
  return event;
}

async function assertPublishedFeedbackSource(sourceId: string, kind: "correction" | "report") {
  const source = await prisma.source.findUnique({
    where: { id: sourceId },
    include: {
      event: {
        select: {
          id: true,
          editorialStatus: true,
          correctionEnabled: true,
          reportEnabled: true
        }
      }
    }
  });
  if (!source || source.event.editorialStatus !== "PUBLISHED") return null;
  if (kind === "correction" && !source.event.correctionEnabled) return null;
  if (kind === "report" && !source.event.reportEnabled) return null;
  return source;
}

async function assertPublishedFeedbackPlatformLink(platformLinkId: string) {
  const link = await prisma.sourcePlatformLink.findUnique({
    where: { id: platformLinkId },
    include: {
      source: {
        include: {
          event: {
            select: {
              id: true,
              editorialStatus: true,
              reportEnabled: true
            }
          }
        }
      }
    }
  });
  if (!link || link.source.event.editorialStatus !== "PUBLISHED" || !link.source.event.reportEnabled) return null;
  return link;
}

export async function registerPublicRoutes(app: FastifyInstance) {
  app.get("/api/events/facets", { schema: { tags: ["public"] } }, async () => {
    const [topics, tags, events, platformLinks] = await Promise.all([
      prisma.topic.findMany({
        where: { events: { some: { editorialStatus: "PUBLISHED" } } },
        orderBy: { name: "asc" },
        include: { _count: { select: { events: { where: { editorialStatus: "PUBLISHED" } } } } }
      }),
      prisma.tag.findMany({
        where: { events: { some: { event: { editorialStatus: "PUBLISHED" } } } },
        orderBy: { label: "asc" },
        include: { _count: { select: { events: { where: { event: { editorialStatus: "PUBLISHED" } } } } } }
      }),
      prisma.event.findMany({
        where: { editorialStatus: "PUBLISHED" },
        select: { eventProcessStatus: true }
      }),
      prisma.sourcePlatformLink.findMany({
        where: { source: { event: { editorialStatus: "PUBLISHED" } } },
        select: { platform: true }
      })
    ]);

    const statuses = new Map<string, number>();
    for (const event of events) {
      statuses.set(event.eventProcessStatus, (statuses.get(event.eventProcessStatus) ?? 0) + 1);
    }
    const platforms = new Map<string, number>();
    for (const link of platformLinks) {
      platforms.set(link.platform, (platforms.get(link.platform) ?? 0) + 1);
    }

    return {
      topics: topics.map((topic) => ({ slug: topic.slug, name: topic.name, count: topic._count.events })),
      tags: tags.map((tag) => ({ slug: tag.slug, label: tag.label, count: tag._count.events })),
      platforms: [...platforms.entries()].map(([platform, count]) => ({ platform, count })),
      statuses: [...statuses.entries()].map(([status, count]) => ({
        status,
        label: getEventProcessStatusLabel(status),
        count
      }))
    };
  });

  app.get("/api/events", { schema: { tags: ["public"] } }, async (request) => {
    const query = eventListQuerySchema.parse(request.query);
    const where: Prisma.EventWhereInput = {};

    where.editorialStatus = "PUBLISHED";

    if (query.query) {
      where.OR = [
        { title: { contains: query.query, mode: "insensitive" } },
        { neutralTitle: { contains: query.query, mode: "insensitive" } },
        { summary: { contains: query.query, mode: "insensitive" } }
      ];
    }
    if (query.topic) where.topic = { slug: query.topic };
    if (query.tag) where.tags = { some: { tag: { slug: query.tag } } };
    if (query.eventProcessStatus) where.eventProcessStatus = query.eventProcessStatus;
    if (query.platform) {
      where.sources = { some: { platformLinks: { some: { platform: query.platform } } } };
    }
    if (query.dateFrom || query.dateTo) {
      where.occurredAt = {
        ...(query.dateFrom ? { gte: query.dateFrom } : {}),
        ...(query.dateTo ? { lte: query.dateTo } : {})
      };
    }

    const orderBy: Prisma.EventOrderByWithRelationInput | Prisma.EventOrderByWithRelationInput[] =
      query.sort === "oldest"
        ? { occurredAt: "asc" as const }
        : query.sort === "newest"
          ? { occurredAt: "desc" as const }
          : query.sort === "sourceCount"
            ? [{ sources: { _count: "desc" as const } }, { updatedAt: "desc" as const }]
            : { updatedAt: "desc" as const };

    const [events, total] = await Promise.all([
      prisma.event.findMany({
        where,
        orderBy,
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: {
          ...eventSummaryInclude
        }
      }),
      prisma.event.count({ where })
    ]);

    const platformCounts = await Promise.all(
      events.map((event) =>
        prisma.sourcePlatformLink.count({
          where: { source: { eventId: event.id } }
        })
      )
    );

    return {
      items: events.map((event, index) => serializeEventSummary(event, platformCounts[index] ?? 0)),
      page: query.page,
      pageSize: query.pageSize,
      total
    };
  });

  app.get("/api/search", { schema: { tags: ["public"] } }, async (request) => {
    const query = searchQuerySchema.parse(request.query);
    const q = query.q;
    const take = Math.min(50, query.pageSize * 4);
    const eventMatches = query.type && query.type !== "event" ? [] : await prisma.event.findMany({
      where: {
        editorialStatus: "PUBLISHED",
        OR: [
          { title: { contains: q, mode: "insensitive" } },
          { neutralTitle: { contains: q, mode: "insensitive" } },
          { summary: { contains: q, mode: "insensitive" } }
        ]
      },
      take,
      orderBy: { updatedAt: "desc" },
      include: eventSummaryInclude
    });
    const sourceMatches = query.type && query.type !== "source" ? [] : await prisma.source.findMany({
      where: {
        event: { editorialStatus: "PUBLISHED" },
        OR: [
          { title: { contains: q, mode: "insensitive" } },
          { summary: { contains: q, mode: "insensitive" } },
          { publisher: { contains: q, mode: "insensitive" } },
          { authorDisplay: { contains: q, mode: "insensitive" } }
        ]
      },
      take,
      orderBy: { updatedAt: "desc" },
      include: { event: { include: eventSummaryInclude } }
    });
    const claimMatches = query.type && query.type !== "claim" ? [] : await prisma.claim.findMany({
      where: {
        event: { editorialStatus: "PUBLISHED" },
        OR: [
          { title: { contains: q, mode: "insensitive" } },
          { statement: { contains: q, mode: "insensitive" } }
        ]
      },
      take,
      orderBy: { updatedAt: "desc" },
      include: { event: { include: eventSummaryInclude } }
    });
    const revisionMatches = query.type && query.type !== "revision" ? [] : await prisma.eventVersion.findMany({
      where: {
        event: { editorialStatus: "PUBLISHED" },
        changeSummary: { contains: q, mode: "insensitive" }
      },
      take,
      orderBy: { createdAt: "desc" },
      include: { event: { include: eventSummaryInclude } }
    });

    const items = [
      ...(await Promise.all(eventMatches.map(async (event) => ({
        id: event.id,
        type: "event" as const,
        matchedField: "event",
        snippet: textSnippet(`${event.neutralTitle}\n${event.summary}`, q),
        updatedAt: event.updatedAt.toISOString(),
        event: await serializeSearchEvent(event)
      })))),
      ...(await Promise.all(sourceMatches.map(async (source) => ({
        id: source.id,
        type: "source" as const,
        matchedField: "source",
        snippet: textSnippet(`${source.title}\n${source.summary}`, q),
        updatedAt: source.updatedAt.toISOString(),
        event: await serializeSearchEvent(source.event)
      })))),
      ...(await Promise.all(claimMatches.map(async (claim) => ({
        id: claim.id,
        type: "claim" as const,
        matchedField: "claim",
        snippet: textSnippet(`${claim.title}\n${claim.statement}`, q),
        updatedAt: claim.updatedAt.toISOString(),
        event: await serializeSearchEvent(claim.event)
      })))),
      ...(await Promise.all(revisionMatches.map(async (version) => ({
        id: version.id,
        type: "revision" as const,
        matchedField: "revision",
        snippet: textSnippet(version.changeSummary, q),
        updatedAt: version.createdAt.toISOString(),
        event: await serializeSearchEvent(version.event)
      }))))
    ].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

    const start = (query.page - 1) * query.pageSize;
    return {
      items: items.slice(start, start + query.pageSize),
      page: query.page,
      pageSize: query.pageSize,
      total: items.length
    };
  });

  app.get("/api/events/:slug", { schema: { tags: ["public"] } }, async (request, reply) => {
    const slug = getSlugParam(request);
    const event = await prisma.event.findFirst({
      where: { slug, editorialStatus: "PUBLISHED" },
      include: {
        topic: true,
        tags: { include: { tag: true } },
        sources: {
          include: {
            platformLinks: { orderBy: [{ displayOrder: "asc" }, { publishedAt: "asc" }] },
            captures: {
              where: { captureStatus: "SUCCEEDED" },
              orderBy: [{ capturedAt: "desc" }, { createdAt: "desc" }]
            }
          }
        },
        _count: {
          select: {
            sources: true,
            timelineEntries: true
          }
        }
      }
    });
    if (!event) return reply.code(404).send({ error: "EVENT_NOT_FOUND" });
    const platformLinkCount = await prisma.sourcePlatformLink.count({
      where: { source: { eventId: event.id } }
    });
    return serializeEventDetail(event, platformLinkCount);
  });

  app.get("/api/events/:slug/timeline", { schema: { tags: ["public"] } }, async (request, reply) => {
    const slug = getSlugParam(request);
    const query = paginationQuerySchema.parse(request.query);
    const event = await prisma.event.findFirst({ where: { slug, editorialStatus: "PUBLISHED" } });
    if (!event) return reply.code(404).send({ error: "EVENT_NOT_FOUND" });
    const [items, total] = await Promise.all([
      prisma.timelineEntry.findMany({
        where: { eventId: event.id },
        orderBy: [{ happenedAt: "asc" }, { sortOrder: "asc" }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: { source: true }
      }),
      prisma.timelineEntry.count({ where: { eventId: event.id } })
    ]);
    return { items: items.map(serializeTimelineEntry), page: query.page, pageSize: query.pageSize, total };
  });

  app.get("/api/events/:slug/claims", { schema: { tags: ["public"] } }, async (request, reply) => {
    const slug = getSlugParam(request);
    const event = await prisma.event.findFirst({ where: { slug, editorialStatus: "PUBLISHED" } });
    if (!event) return reply.code(404).send({ error: "EVENT_NOT_FOUND" });
    const claims = await prisma.claim.findMany({
      where: { eventId: event.id },
      orderBy: [{ importance: "asc" }, { createdAt: "asc" }],
      include: {
        claimantActor: true,
        evidenceLinks: {
          include: {
            evidence: {
              include: {
                source: true
              }
            }
          }
        }
      }
    });
    return { items: claims.map(serializeClaim) };
  });

  app.get("/api/events/:slug/sources", { schema: { tags: ["public"] } }, async (request, reply) => {
    const slug = getSlugParam(request);
    const query = paginationQuerySchema.parse(request.query);
    const event = await prisma.event.findFirst({ where: { slug, editorialStatus: "PUBLISHED" } });
    if (!event) return reply.code(404).send({ error: "EVENT_NOT_FOUND" });
    const [sources, total] = await Promise.all([
      prisma.source.findMany({
        where: { eventId: event.id },
        orderBy: [{ publishedAt: "asc" }, { createdAt: "asc" }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize
      }),
      prisma.source.count({ where: { eventId: event.id } })
    ]);
    return { items: sources.map(serializeSource), page: query.page, pageSize: query.pageSize, total };
  });

  app.get("/api/events/:slug/platform-links", { schema: { tags: ["public"] } }, async (request, reply) => {
    const slug = getSlugParam(request);
    const event = await prisma.event.findFirst({ where: { slug, editorialStatus: "PUBLISHED" } });
    if (!event) return reply.code(404).send({ error: "EVENT_NOT_FOUND" });
    const links = await prisma.sourcePlatformLink.findMany({
      where: { source: { eventId: event.id } },
      orderBy: [{ displayOrder: "asc" }, { publishedAt: "asc" }]
    });
    return { items: links.map(serializePlatformLink) };
  });

  app.get("/api/events/:slug/versions", { schema: { tags: ["public"] } }, async (request, reply) => {
    const slug = getSlugParam(request);
    const event = await prisma.event.findFirst({ where: { slug, editorialStatus: "PUBLISHED" } });
    if (!event) return reply.code(404).send({ error: "EVENT_NOT_FOUND" });
    const versions = await prisma.eventVersion.findMany({
      where: { eventId: event.id },
      orderBy: { versionNumber: "desc" },
      select: {
        id: true,
        versionNumber: true,
        changeSummary: true,
        createdAt: true
      }
    });
    return {
      items: versions.map((version) => ({
        id: version.id,
        versionNumber: version.versionNumber,
        changeSummary: version.changeSummary,
        createdAt: version.createdAt.toISOString()
      }))
    };
  });

  app.get("/api/feed.xml", { schema: { tags: ["public"] } }, async (_request, reply) => {
    const events = await prisma.event.findMany({
      where: { editorialStatus: "PUBLISHED" },
      orderBy: { updatedAt: "desc" },
      take: 30
    });
    const site = getPublicSiteUrl();
    const xml = buildRssFeed({
      title: "公共事件长记忆档案馆",
      link: site,
      description: "克制记录公共事件来源、时间线、争议和修订。",
      items: events.map((event) => ({
        title: event.neutralTitle,
        link: `${site}/events/${event.slug}`,
        description: event.summary,
        pubDate: event.updatedAt,
        guid: `event:${event.id}:${event.updatedAt.toISOString()}`
      }))
    });
    return reply.type("application/rss+xml; charset=utf-8").send(xml);
  });

  app.get("/api/events/:slug/feed.xml", { schema: { tags: ["public"] } }, async (request, reply) => {
    const slug = getSlugParam(request);
    const event = await prisma.event.findFirst({ where: { slug, editorialStatus: "PUBLISHED" } });
    if (!event) return reply.code(404).send({ error: "EVENT_NOT_FOUND" });
    const versions = await prisma.eventVersion.findMany({
      where: { eventId: event.id },
      orderBy: { createdAt: "desc" },
      take: 20
    });
    const site = getPublicSiteUrl();
    const xml = buildRssFeed({
      title: `${event.neutralTitle} - 修订记录`,
      link: `${site}/events/${event.slug}`,
      description: event.summary,
      items: versions.map((version) => ({
        title: `版本 ${version.versionNumber}: ${version.changeSummary}`,
        link: `${site}/events/${event.slug}#revision-history`,
        description: version.changeSummary,
        pubDate: version.createdAt,
        guid: `event-version:${version.id}`
      }))
    });
    return reply.type("application/rss+xml; charset=utf-8").send(xml);
  });

  app.get("/api/feedback/:id", { schema: { tags: ["public"] } }, async (request, reply) => {
    const id = getIdParam(request);
    const [submission, correction, report] = await Promise.all([
      prisma.submission.findUnique({ where: { id } }),
      prisma.correction.findUnique({ where: { id } }),
      prisma.report.findUnique({ where: { id } })
    ]);
    const item = submission ?? correction ?? report;
    if (!item) return reply.code(404).send({ error: "FEEDBACK_NOT_FOUND" });
    const kind = submission ? "submission" : correction ? "correction" : "report";
    return {
      id: item.id,
      kind,
      status: item.status,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
      ...(report ? { priority: report.priority, priorityLabel: report.priority >= 10 ? "urgent" : "normal" } : {})
    };
  });

  app.post("/api/submissions", { schema: { tags: ["public"] } }, async (request, reply) => {
    if (rejectIfLimited(reply, consumeBucket(clientKey(request, "public-feedback"), 20, 60 * 1000))) return;
    if (isUnsafeFeedbackBody(request.body)) return reply.code(400).send({ error: "SPAM_TRAP" });
    const body = submissionSchema.parse(request.body);
    if (body.eventId && !(await assertPublishedFeedbackEvent(body.eventId, "submission"))) {
      return reply.code(404).send({ error: "FEEDBACK_TARGET_NOT_FOUND" });
    }
    const submission = await prisma.submission.create({ data: body });
    return reply.code(201).send({ id: submission.id, status: submission.status });
  });

  app.post("/api/corrections", { schema: { tags: ["public"] } }, async (request, reply) => {
    if (rejectIfLimited(reply, consumeBucket(clientKey(request, "public-feedback"), 20, 60 * 1000))) return;
    if (isUnsafeFeedbackBody(request.body)) return reply.code(400).send({ error: "SPAM_TRAP" });
    const body = correctionSchema.parse(request.body);
    if (body.eventId && !(await assertPublishedFeedbackEvent(body.eventId, "correction"))) {
      return reply.code(404).send({ error: "FEEDBACK_TARGET_NOT_FOUND" });
    }
    if (body.sourceId && !(await assertPublishedFeedbackSource(body.sourceId, "correction"))) {
      return reply.code(404).send({ error: "FEEDBACK_TARGET_NOT_FOUND" });
    }
    const correction = await prisma.correction.create({ data: body });
    return reply.code(201).send({ id: correction.id, status: correction.status });
  });

  app.post("/api/reports", { schema: { tags: ["public"] } }, async (request, reply) => {
    if (rejectIfLimited(reply, consumeBucket(clientKey(request, "public-feedback"), 20, 60 * 1000))) return;
    if (isUnsafeFeedbackBody(request.body)) return reply.code(400).send({ error: "SPAM_TRAP" });
    const body = reportSchema.parse(request.body);
    if (body.eventId && !(await assertPublishedFeedbackEvent(body.eventId, "report"))) {
      return reply.code(404).send({ error: "FEEDBACK_TARGET_NOT_FOUND" });
    }
    if (body.sourceId && !(await assertPublishedFeedbackSource(body.sourceId, "report"))) {
      return reply.code(404).send({ error: "FEEDBACK_TARGET_NOT_FOUND" });
    }
    if (body.platformLinkId && !(await assertPublishedFeedbackPlatformLink(body.platformLinkId))) {
      return reply.code(404).send({ error: "FEEDBACK_TARGET_NOT_FOUND" });
    }
    const report = await prisma.report.create({
      data: {
        ...body,
        priority: body.reportType === "MINOR_INFO" || body.reportType === "DOXXING" ? 10 : 0
      }
    });
    return reply.code(201).send({ id: report.id, status: report.status });
  });
}
