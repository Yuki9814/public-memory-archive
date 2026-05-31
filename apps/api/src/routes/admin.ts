import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import {
  createClaimEvidenceLinkSchema,
  createClaimSchema,
  createEvidenceSchema,
  createEventSchema,
  createPlatformLinkSchema,
  createSourceSchema,
  createTimelineEntrySchema,
  updateEventSchema
} from "@memory-archive/shared";
import { prisma } from "@memory-archive/db";
import { getAdminSession } from "../lib/auth.js";
import { runPublishPreflight } from "../lib/preflight.js";
import { getIdParam, getTaskIdParam } from "../lib/route-params.js";
import { enqueueCaptureTask } from "../lib/task-queue.js";

function adminUserId(request: FastifyRequest) {
  const session = getAdminSession(request);
  if (!session || session.role !== "ADMIN") return undefined;
  if (session.userId) return session.userId;
  const value = request.headers["x-admin-user-id"];
  return typeof value === "string" ? value : undefined;
}

function snapshot(value: unknown) {
  return JSON.parse(JSON.stringify(value));
}

async function loadEventSnapshot(eventId: string) {
  return prisma.event.findUnique({
    where: { id: eventId },
    include: {
      topic: true,
      tags: { include: { tag: true } },
      eventActors: { include: { actor: true } },
      sources: { include: { platformLinks: true } },
      timelineEntries: true,
      claims: { include: { evidenceLinks: true } }
    }
  });
}

async function createEventVersion(
  eventId: string,
  snapshotBefore: unknown,
  snapshotAfter: unknown,
  changeSummary: string,
  createdByUserId?: string
) {
  const count = await prisma.eventVersion.count({ where: { eventId } });
  return prisma.eventVersion.create({
    data: {
      eventId,
      versionNumber: count + 1,
      snapshotBefore: snapshot(snapshotBefore ?? {}),
      snapshotAfter: snapshot(snapshotAfter ?? {}),
      changeSummary,
      createdByUserId
    }
  });
}

async function loadPreflightEvent(eventId: string) {
  return prisma.event.findUnique({
    where: { id: eventId },
    include: {
      eventActors: { include: { actor: true } },
      sources: { include: { platformLinks: true } },
      timelineEntries: true,
      claims: { include: { evidenceLinks: true } },
      eventVersions: true
    }
  });
}

function sourceTypeFromContentKind(contentKind: string) {
  if (contentKind === "VIDEO") return "VIDEO";
  if (contentKind === "NOTE") return "NOTE";
  if (contentKind === "POST") return "ORIGINAL_POST";
  if (contentKind === "ARTICLE") return "MEDIA_REPORT";
  return "OTHER";
}

export async function registerAdminRoutes(app: FastifyInstance) {
  app.post("/admin/events", { schema: { tags: ["admin"] } }, async (request, reply) => {
    const body = createEventSchema.parse(request.body);
    const event = await prisma.event.create({ data: body as any });
    await createEventVersion(event.id, {}, event, "创建事件草稿", adminUserId(request));
    await prisma.auditLog.create({
      data: {
        userId: adminUserId(request),
        entityType: "Event",
        entityId: event.id,
        action: "CREATED",
        after: snapshot(event)
      }
    });
    return reply.code(201).send(event);
  });

  app.patch("/admin/events/:id", { schema: { tags: ["admin"] } }, async (request, reply) => {
    const id = getIdParam(request);
    const body = updateEventSchema.parse(request.body);
    const before = await loadEventSnapshot(id);
    if (!before) return reply.code(404).send({ error: "EVENT_NOT_FOUND" });
    const event = await prisma.event.update({ where: { id }, data: body as any });
    const after = await loadEventSnapshot(id);
    await createEventVersion(id, before, after, "更新事件核心信息", adminUserId(request));
    await prisma.auditLog.create({
      data: {
        userId: adminUserId(request),
        entityType: "Event",
        entityId: id,
        action: "UPDATED",
        before: snapshot(before),
        after: snapshot(after)
      }
    });
    return event;
  });

  app.post("/admin/events/:id/sources", { schema: { tags: ["admin"] } }, async (request, reply) => {
    const id = getIdParam(request);
    const body = createSourceSchema.parse(request.body);
    const source = await prisma.source.create({
      data: {
        ...(body as any),
        eventId: id
      }
    });
    return reply.code(201).send(source);
  });

  app.post("/admin/events/:id/platform-links", { schema: { tags: ["admin"] } }, async (request, reply) => {
    const id = getIdParam(request);
    const body = createPlatformLinkSchema.parse(request.body);
    let sourceId = body.sourceId;

    if (sourceId) {
      const source = await prisma.source.findFirst({ where: { id: sourceId, eventId: id } });
      if (!source) return reply.code(404).send({ error: "SOURCE_NOT_FOUND" });
    } else {
      const source = await prisma.source.create({
        data: {
          eventId: id,
          title: body.title,
          url: body.originalUrl,
          sourceType: sourceTypeFromContentKind(body.contentKind) as any,
          reliabilityLevel: "B_DIRECT",
          publisher: body.platform,
          authorDisplay: body.authorDisplay,
          publishedAt: body.publishedAt,
          summary: body.description
        }
      });
      sourceId = source.id;
    }

    const link = await prisma.sourcePlatformLink.create({
      data: {
        sourceId,
        platform: body.platform,
        contentKind: body.contentKind,
        originalUrl: body.originalUrl,
        canonicalUrl: body.canonicalUrl,
        title: body.title,
        description: body.description,
        authorDisplay: body.authorDisplay,
        thumbnailUrl: body.thumbnailUrl,
        publishedAt: body.publishedAt,
        capturedAt: body.capturedAt,
        availabilityStatus: body.availabilityStatus,
        engagementSnapshot: body.engagementSnapshot,
        displayOrder: body.displayOrder,
        archiveUrl: body.archiveUrl
      } as any
    });
    return reply.code(201).send(link);
  });

  app.post("/admin/sources/:id/capture", { schema: { tags: ["admin"] } }, async (request, reply) => {
    const id = getIdParam(request);
    const source = await prisma.source.findUnique({ where: { id } });
    if (!source) return reply.code(404).send({ error: "SOURCE_NOT_FOUND" });
    const task = await prisma.task.create({
      data: {
        type: "CAPTURE_SOURCE",
        status: "QUEUED",
        subjectType: "Source",
        subjectId: id,
        payload: { sourceId: id, requestedAt: new Date().toISOString() }
      }
    });
    const queued = await enqueueCaptureTask(task.id, id);
    await prisma.auditLog.create({
      data: {
        userId: adminUserId(request),
        entityType: "Source",
        entityId: id,
        action: "CAPTURE_REQUESTED",
        metadata: { taskId: task.id, queued }
      }
    });
    return reply.code(202).send({ taskId: task.id, queued });
  });

  app.get("/admin/tasks/:taskId", { schema: { tags: ["admin"] } }, async (request, reply) => {
    const taskId = getTaskIdParam(request);
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: { captures: true }
    });
    if (!task) return reply.code(404).send({ error: "TASK_NOT_FOUND" });
    return task;
  });

  app.post("/admin/events/:id/timeline", { schema: { tags: ["admin"] } }, async (request, reply) => {
    const id = getIdParam(request);
    const body = createTimelineEntrySchema.parse(request.body);
    const entry = await prisma.timelineEntry.create({
      data: {
        ...(body as any),
        eventId: id
      }
    });
    return reply.code(201).send(entry);
  });

  app.post("/admin/events/:id/claims", { schema: { tags: ["admin"] } }, async (request, reply) => {
    const id = getIdParam(request);
    const body = createClaimSchema.parse(request.body);
    const claim = await prisma.claim.create({
      data: {
        ...(body as any),
        eventId: id
      }
    });
    return reply.code(201).send(claim);
  });

  app.post("/admin/events/:id/evidence", { schema: { tags: ["admin"] } }, async (request, reply) => {
    const id = getIdParam(request);
    const body = createEvidenceSchema.parse(request.body);
    const evidence = await prisma.evidenceItem.create({
      data: {
        ...(body as any),
        eventId: id
      }
    });
    return reply.code(201).send(evidence);
  });

  app.post("/admin/claims/:id/evidence-links", { schema: { tags: ["admin"] } }, async (request, reply) => {
    const id = getIdParam(request);
    const body = createClaimEvidenceLinkSchema.parse(request.body);
    const link = await prisma.claimEvidenceLink.create({
      data: {
        claimId: id,
        evidenceId: body.evidenceId,
        relationType: body.relationType,
        notes: body.notes
      }
    });
    return reply.code(201).send(link);
  });

  app.post("/admin/events/:id/review", { schema: { tags: ["admin"] } }, async (request, reply) => {
    const id = getIdParam(request);
    const task = await prisma.reviewTask.create({
      data: {
        eventId: id,
        assignedToUserId: adminUserId(request),
        status: "OPEN",
        notes: "机器预检前的编辑审核请求。"
      }
    });
    await prisma.event.update({
      where: { id },
      data: { editorialStatus: "PENDING_REVIEW" }
    });
    await prisma.auditLog.create({
      data: {
        userId: adminUserId(request),
        entityType: "Event",
        entityId: id,
        action: "REVIEW_REQUESTED",
        metadata: { reviewTaskId: task.id }
      }
    });
    return reply.code(201).send(task);
  });

  app.post("/admin/events/:id/publish", { schema: { tags: ["admin"] } }, async (request, reply) => {
    const id = getIdParam(request);
    const before = await loadEventSnapshot(id);
    if (!before) return reply.code(404).send({ error: "EVENT_NOT_FOUND" });

    const versionCount = await prisma.eventVersion.count({ where: { eventId: id } });
    if (versionCount === 0) {
      await createEventVersion(id, {}, before, "发布前机器预检快照", adminUserId(request));
    }

    const preflightEvent = await loadPreflightEvent(id);
    if (!preflightEvent) return reply.code(404).send({ error: "EVENT_NOT_FOUND" });

    const failedChecks = runPublishPreflight(preflightEvent);
    if (failedChecks.length > 0) {
      return reply.code(400).send({ error: "PUBLISH_PREFLIGHT_FAILED", failedChecks });
    }

    const published = await prisma.event.update({
      where: { id },
      data: {
        editorialStatus: "PUBLISHED",
        firstPublishedAt: preflightEvent.firstPublishedAt ?? new Date()
      }
    });
    const after = await loadEventSnapshot(id);
    await createEventVersion(id, before, after, "发布事件档案", adminUserId(request));
    await prisma.auditLog.create({
      data: {
        userId: adminUserId(request),
        entityType: "Event",
        entityId: id,
        action: "PUBLISHED",
        before: snapshot(before),
        after: snapshot(after)
      }
    });
    return published;
  });

  app.post("/admin/events/:id/unpublish", { schema: { tags: ["admin"] } }, async (request, reply) => {
    const id = getIdParam(request);
    const before = await loadEventSnapshot(id);
    if (!before) return reply.code(404).send({ error: "EVENT_NOT_FOUND" });
    const event = await prisma.event.update({
      where: { id },
      data: { editorialStatus: "UNPUBLISHED" }
    });
    const after = await loadEventSnapshot(id);
    await createEventVersion(id, before, after, "下架事件档案", adminUserId(request));
    await prisma.auditLog.create({
      data: {
        userId: adminUserId(request),
        entityType: "Event",
        entityId: id,
        action: "UNPUBLISHED",
        before: snapshot(before),
        after: snapshot(after)
      }
    });
    return event;
  });

  app.get("/admin/review-tasks", { schema: { tags: ["admin"] } }, async () => {
    return prisma.reviewTask.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        event: true,
        assignedTo: true
      }
    });
  });

  app.get("/admin/reports", { schema: { tags: ["admin"] } }, async () => {
    return prisma.report.findMany({
      orderBy: [{ status: "asc" }, { priority: "desc" }, { createdAt: "desc" }],
      include: {
        event: true,
        source: true,
        platformLink: true
      }
    });
  });

  app.post("/admin/reports/:id/resolve", { schema: { tags: ["admin"] } }, async (request, reply) => {
    const id = getIdParam(request);
    const body = z
      .object({
        status: z.enum(["RESOLVED", "REJECTED", "TRIAGED"]).default("RESOLVED"),
        resolutionNotes: z.string().min(1).max(2000)
      })
      .parse(request.body);
    const report = await prisma.report.update({
      where: { id },
      data: {
        status: body.status,
        resolutionNotes: body.resolutionNotes,
        resolvedAt: body.status === "RESOLVED" ? new Date() : null
      }
    });
    await prisma.auditLog.create({
      data: {
        userId: adminUserId(request),
        entityType: "Report",
        entityId: id,
        action: "REPORT_RESOLVED",
        metadata: body
      }
    });
    return report;
  });
}
