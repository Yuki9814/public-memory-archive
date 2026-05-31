import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { prisma, type SourcePlatformLink } from "@memory-archive/db";
import { getStorageLocalDir } from "./storage-config.js";
import { isConfiguredWaybackEnabled } from "./wayback-config.js";

type CaptureTarget = {
  sourceId: string;
  platformLinkId?: string;
  url: string;
};

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function sha256(value: string | Buffer) {
  return createHash("sha256").update(value).digest("hex");
}

async function saveHtmlSnapshot(captureId: string, html: string) {
  const dir = getStorageLocalDir();
  await mkdir(dir, { recursive: true });
  const path = join(dir, `${captureId}.html`);
  await writeFile(path, html, "utf8");
  return path;
}

async function maybeSaveWayback(url: string) {
  if (!isConfiguredWaybackEnabled()) return null;
  const endpoint = `https://web.archive.org/save/${encodeURIComponent(url)}`;
  const response = await fetch(endpoint, { method: "GET" });
  if (!response.ok) return null;
  return response.url;
}

async function captureOne(target: CaptureTarget, taskId: string) {
  const capture = await prisma.archiveCapture.create({
    data: {
      sourceId: target.sourceId,
      platformLinkId: target.platformLinkId,
      taskId,
      originalUrl: target.url,
      captureStatus: "RUNNING"
    }
  });

  try {
    const response = await fetch(target.url, {
      redirect: "follow",
      headers: {
        "user-agent": "PublicMemoryArchiveBot/0.1 (+https://example.org/archive-bot)"
      }
    });
    const body = await response.text();
    const contentHash = sha256(body);
    const htmlSnapshotUrl = await saveHtmlSnapshot(capture.id, body);
    const waybackUrl = await maybeSaveWayback(target.url);

    await prisma.archiveCapture.update({
      where: { id: capture.id },
      data: {
        finalUrl: response.url,
        htmlSnapshotUrl,
        waybackUrl,
        contentHash,
        captureStatus: response.ok ? "SUCCEEDED" : "FAILED",
        errorMessage: response.ok ? null : `HTTP ${response.status}`,
        capturedAt: new Date(),
        nextRecaptureAt: addDays(new Date(), 14)
      }
    });

    if (target.platformLinkId) {
      await prisma.sourcePlatformLink.update({
        where: { id: target.platformLinkId },
        data: {
          capturedAt: new Date(),
          availabilityStatus: response.ok ? "AVAILABLE" : "UNKNOWN",
          archiveUrl: waybackUrl ?? undefined
        }
      });
    }

    return { captureId: capture.id, ok: response.ok, hash: contentHash };
  } catch (error) {
    await prisma.archiveCapture.update({
      where: { id: capture.id },
      data: {
        captureStatus: "FAILED",
        errorMessage: error instanceof Error ? error.message : String(error),
        nextRecaptureAt: addDays(new Date(), 3)
      }
    });
    return { captureId: capture.id, ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export async function captureSource(taskId: string, sourceId: string) {
  await prisma.task.update({
    where: { id: taskId },
    data: { status: "ACTIVE", progress: 5 }
  });

  const source = await prisma.source.findUnique({
    where: { id: sourceId },
    include: { platformLinks: true }
  });

  if (!source) {
    await prisma.task.update({
      where: { id: taskId },
      data: {
        status: "FAILED",
        progress: 100,
        errorMessage: "SOURCE_NOT_FOUND",
        completedAt: new Date()
      }
    });
    return;
  }

  const targets: CaptureTarget[] = [
    ...(source.url ? [{ sourceId: source.id, url: source.url }] : []),
    ...source.platformLinks.map((link: SourcePlatformLink) => ({
      sourceId: source.id,
      platformLinkId: link.id,
      url: link.canonicalUrl ?? link.originalUrl
    }))
  ];

  if (targets.length === 0) {
    await prisma.task.update({
      where: { id: taskId },
      data: {
        status: "COMPLETED",
        progress: 100,
        result: { captures: [], note: "No URL targets on source." },
        completedAt: new Date()
      }
    });
    return;
  }

  const results = [];
  for (const [index, target] of targets.entries()) {
    results.push(await captureOne(target, taskId));
    await prisma.task.update({
      where: { id: taskId },
      data: {
        progress: Math.round(((index + 1) / targets.length) * 90) + 5
      }
    });
  }

  const failed = results.filter((result) => !result.ok);
  await prisma.task.update({
    where: { id: taskId },
    data: {
      status: failed.length === results.length ? "FAILED" : "COMPLETED",
      progress: 100,
      result: { captures: results },
      errorMessage: failed.length === results.length ? "All capture targets failed." : null,
      completedAt: new Date()
    }
  });
}
