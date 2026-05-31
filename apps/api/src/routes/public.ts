import type { FastifyInstance } from "fastify";
import {
  buildRssFeed,
  correctionSchema,
  eventListQuerySchema,
  paginationQuerySchema,
  reportSchema,
  submissionSchema
} from "@memory-archive/shared";
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
import { getSlugParam } from "../lib/route-params.js";

export async function registerPublicRoutes(app: FastifyInstance) {
  app.get("/api/events", { schema: { tags: ["public"] } }, async (request) => {
    const query = eventListQuerySchema.parse(request.query);
    const where: Prisma.EventWhereInput = {};

    where.editorialStatus = query.editorialStatus ?? "PUBLISHED";

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

  app.post("/api/submissions", { schema: { tags: ["public"] } }, async (request, reply) => {
    const body = submissionSchema.parse(request.body);
    const submission = await prisma.submission.create({ data: body });
    return reply.code(201).send({ id: submission.id, status: submission.status });
  });

  app.post("/api/corrections", { schema: { tags: ["public"] } }, async (request, reply) => {
    const body = correctionSchema.parse(request.body);
    const correction = await prisma.correction.create({ data: body });
    return reply.code(201).send({ id: correction.id, status: correction.status });
  });

  app.post("/api/reports", { schema: { tags: ["public"] } }, async (request, reply) => {
    const body = reportSchema.parse(request.body);
    const report = await prisma.report.create({
      data: {
        ...body,
        priority: body.reportType === "MINOR_INFO" || body.reportType === "DOXXING" ? 10 : 0
      }
    });
    return reply.code(201).send({ id: report.id, status: report.status });
  });
}
