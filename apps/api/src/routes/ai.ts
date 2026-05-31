import type { FastifyInstance } from "fastify";
import { prisma, type Source } from "@memory-archive/db";
import { containsSensitivePersonalInfo, findIncitingTerms } from "@memory-archive/shared";
import { getIdParam } from "../lib/route-params.js";

function suggestionResponse(suggestions: unknown[]) {
  return {
    mode: "suggestions_only",
    writesToDatabase: false,
    policy:
      "AI helpers may suggest summaries, timelines, claims, source categories, and neutrality checks. They never publish, determine guilt, expose private data, or assign blame to gender groups.",
    suggestions
  };
}

export async function registerAiRoutes(app: FastifyInstance) {
  app.post("/admin/events/:id/ai/suggest-summary", { schema: { tags: ["ai"] } }, async (request, reply) => {
    const id = getIdParam(request);
    const event = await prisma.event.findUnique({
      where: { id },
      include: {
        timelineEntries: { orderBy: { happenedAt: "asc" }, take: 5 },
        sources: { take: 5 }
      }
    });
    if (!event) return reply.code(404).send({ error: "EVENT_NOT_FOUND" });
    return suggestionResponse([
      {
        field: "summary",
        text: `${event.neutralTitle} 的公开资料显示，事件经历了初始发布、回应、平台或机构介入以及后续核验阶段。建议继续区分当事人陈述、官方说明和媒体转述。`
      },
      {
        field: "latestUpdates",
        text: "可将最近一次官方或平台回应放入 latestUpdates，并避免加入评论区推断。"
      }
    ]);
  });

  app.post("/admin/events/:id/ai/extract-timeline", { schema: { tags: ["ai"] } }, async (request, reply) => {
    const id = getIdParam(request);
    const event = await prisma.event.findUnique({ where: { id }, select: { id: true } });
    if (!event) return reply.code(404).send({ error: "EVENT_NOT_FOUND" });
    const sources = await prisma.source.findMany({
      where: { eventId: id },
      orderBy: { publishedAt: "asc" }
    });
    return suggestionResponse(
      sources.map((source: Source) => ({
        title: `${source.publisher ?? "来源"}发布材料`,
        happenedAt: source.publishedAt,
        sourceId: source.id,
        body: source.summary
      }))
    );
  });

  app.post("/admin/events/:id/ai/extract-claims", { schema: { tags: ["ai"] } }, async (request, reply) => {
    const id = getIdParam(request);
    const event = await prisma.event.findUnique({ where: { id }, select: { id: true } });
    if (!event) return reply.code(404).send({ error: "EVENT_NOT_FOUND" });
    const sources = await prisma.source.findMany({ where: { eventId: id }, take: 10 });
    return suggestionResponse(
      sources.map((source: Source) => ({
        title: `来自「${source.title}」的待审主张`,
        statement: source.summary,
        sourceId: source.id,
        status: source.reliabilityLevel === "D_WEAK" ? "INSUFFICIENT_EVIDENCE" : "UNVERIFIED"
      }))
    );
  });

  app.post("/admin/sources/:id/ai/classify-type", { schema: { tags: ["ai"] } }, async (request, reply) => {
    const id = getIdParam(request);
    const source = await prisma.source.findUnique({ where: { id } });
    if (!source) return reply.code(404).send({ error: "SOURCE_NOT_FOUND" });
    const title = `${source.title} ${source.url ?? ""}`.toLowerCase();
    const sourceType = title.includes("bilibili")
      ? "VIDEO"
      : title.includes("weibo") || title.includes("xhs")
        ? "ORIGINAL_POST"
        : title.includes("statement") || title.includes("说明")
          ? "OFFICIAL_NOTICE"
          : "OTHER";
    return suggestionResponse([{ field: "sourceType", value: sourceType, confidence: 0.62 }]);
  });

  app.post("/admin/events/:id/ai/check-neutrality", { schema: { tags: ["ai"] } }, async (request, reply) => {
    const id = getIdParam(request);
    const event = await prisma.event.findUnique({ where: { id } });
    if (!event) return reply.code(404).send({ error: "EVENT_NOT_FOUND" });
    const text = `${event.title}\n${event.neutralTitle}\n${event.summary}`;
    const inciting = findIncitingTerms(text);
    const sensitive = containsSensitivePersonalInfo(text);
    return suggestionResponse([
      {
        field: "neutrality",
        severity: inciting.length > 0 ? "high" : "low",
        terms: inciting,
        message:
          inciting.length > 0
            ? "标题或摘要存在动员、嘲讽或群体归因风险，建议改为事实性表述。"
            : "未发现内置词表中的明显煽动词。"
      },
      {
        field: "privacy",
        severity: sensitive ? "high" : "low",
        message: sensitive ? "检测到疑似个人敏感信息，需要人工复核。" : "未检测到常见手机号、证件号或住址模式。"
      }
    ]);
  });
}
