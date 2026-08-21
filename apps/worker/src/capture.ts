import { prisma, type SourcePlatformLink } from "@memory-archive/db";
import { ArchiveArtifactStore, LocalStorageAdapter } from "@memory-archive/storage";
import { getStorageLocalDir } from "./storage-config.js";
import { isConfiguredWaybackEnabled } from "./wayback-config.js";
import { readLimitedTextArtifact, safeFetch } from "./capture-safety.js";

type CaptureTarget = {
  sourceId: string;
  platformLinkId?: string;
  url: string;
};

export type CaptureAttemptResult = {
  captureId: string;
  ok: boolean;
  hash?: string;
  objectKey?: string;
  bytes?: number;
  contentType?: string;
  error?: string;
};

export function summarizeCaptureResults(results: CaptureAttemptResult[]) {
  if (results.length === 0) {
    return {
      status: "COMPLETED" as const,
      errorMessage: null,
      result: { captures: [], note: "No URL targets on source." }
    };
  }
  const failed = results.filter((result) => !result.ok);
  return {
    status: failed.length === results.length ? "FAILED" as const : "COMPLETED" as const,
    errorMessage: failed.length === results.length ? "All capture targets failed." : null,
    result: { captures: results }
  };
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

const artifactStore = new ArchiveArtifactStore(new LocalStorageAdapter(getStorageLocalDir()));

async function maybeSaveWayback(url: string) {
  if (!isConfiguredWaybackEnabled()) return null;
  const endpoint = `https://web.archive.org/save/${encodeURIComponent(url)}`;
  const response = await safeFetch(endpoint, { method: "GET" });
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
    const response = await safeFetch(target.url, {
      headers: {
        "user-agent": "PublicMemoryArchiveBot/0.1 (+https://example.org/archive-bot)"
      }
    });
    const captured = await readLimitedTextArtifact(response);
    const artifact = await artifactStore.putText(captured.text, captured.contentType);
    const waybackUrl = await maybeSaveWayback(target.url);

    await prisma.archiveCapture.update({
      where: { id: capture.id },
      data: {
        finalUrl: response.url,
        artifactKey: artifact.objectKey,
        artifactContentType: artifact.contentType,
        artifactBytes: artifact.bytes,
        waybackUrl,
        contentHash: artifact.contentHash,
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

    return {
      captureId: capture.id,
      ok: response.ok,
      hash: artifact.contentHash,
      objectKey: artifact.objectKey,
      bytes: artifact.bytes,
      contentType: artifact.contentType
    };
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
    const summary = summarizeCaptureResults([]);
    await prisma.task.update({
      where: { id: taskId },
      data: {
        status: summary.status,
        progress: 100,
        result: summary.result,
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

  const summary = summarizeCaptureResults(results);
  await prisma.task.update({
    where: { id: taskId },
    data: {
      status: summary.status,
      progress: 100,
      result: summary.result,
      errorMessage: summary.errorMessage,
      completedAt: new Date()
    }
  });
}
