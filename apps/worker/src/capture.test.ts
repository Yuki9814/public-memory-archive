import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { ArchiveArtifactStore, LocalStorageAdapter } from "@memory-archive/storage";
import {
  persistCaptureResponse,
  summarizeCaptureResults,
  type CapturePersistence
} from "./capture.js";

test("summarizeCaptureResults handles sources without URL targets", () => {
  const summary = summarizeCaptureResults([]);
  assert.equal(summary.status, "COMPLETED");
  assert.equal(summary.errorMessage, null);
  assert.deepEqual(summary.result, { captures: [], note: "No URL targets on source." });
});

test("summarizeCaptureResults marks full success as completed", () => {
  const summary = summarizeCaptureResults([{ captureId: "c1", ok: true, hash: "abc" }]);
  assert.equal(summary.status, "COMPLETED");
  assert.equal(summary.errorMessage, null);
  assert.equal(summary.result.captures.length, 1);
});

test("summarizeCaptureResults keeps partial failure completed", () => {
  const summary = summarizeCaptureResults([
    { captureId: "c1", ok: true },
    { captureId: "c2", ok: false, error: "HTTP 500" }
  ]);
  assert.equal(summary.status, "COMPLETED");
  assert.equal(summary.errorMessage, null);
});

test("summarizeCaptureResults marks total failure as failed", () => {
  const summary = summarizeCaptureResults([{ captureId: "c1", ok: false, error: "blocked" }]);
  assert.equal(summary.status, "FAILED");
  assert.equal(summary.errorMessage, "All capture targets failed.");
});

test("persistCaptureResponse writes the object and all database lifecycle metadata", async () => {
  const directory = await mkdtemp(join(tmpdir(), "memory-archive-worker-"));
  const store = new ArchiveArtifactStore(new LocalStorageAdapter(directory));
  let captureUpdate: Parameters<CapturePersistence["updateCapture"]>[1] | undefined;
  let platformUpdate: Parameters<CapturePersistence["updatePlatformLink"]>[1] | undefined;
  const persistence: CapturePersistence = {
    async updateCapture(_captureId, data) {
      captureUpdate = data;
    },
    async updatePlatformLink(_platformLinkId, data) {
      platformUpdate = data;
    }
  };
  const capturedAt = new Date("2026-08-21T12:00:00.000Z");

  try {
    const result = await persistCaptureResponse(
      {
        sourceId: "source-1",
        platformLinkId: "platform-1",
        url: "https://example.org/evidence"
      },
      "capture-1",
      new Response("<html>durable evidence</html>", {
        headers: { "content-type": "text/html; charset=iso-8859-1" },
        status: 200
      }),
      {
        store,
        persistence,
        saveWayback: async () => "https://web.archive.org/example",
        now: () => capturedAt
      }
    );

    assert.equal(result.ok, true);
    assert.equal(captureUpdate?.artifactKey, result.objectKey);
    assert.equal(captureUpdate?.artifactContentType, "text/html; charset=utf-8");
    assert.equal(captureUpdate?.artifactBytes, Buffer.byteLength("<html>durable evidence</html>"));
    assert.equal(captureUpdate?.contentHash, result.hash);
    assert.equal(captureUpdate?.captureStatus, "SUCCEEDED");
    assert.equal(captureUpdate?.capturedAt, capturedAt);
    assert.equal(captureUpdate?.nextRecaptureAt.toISOString(), "2026-09-04T12:00:00.000Z");
    assert.equal(platformUpdate?.availabilityStatus, "AVAILABLE");
    assert.equal(platformUpdate?.archiveUrl, "https://web.archive.org/example");

    const artifact = await store.get(result.objectKey as string);
    assert.equal(Buffer.from(artifact!.body).toString("utf8"), "<html>durable evidence</html>");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("persistCaptureResponse records a non-2xx capture as failed while retaining evidence", async () => {
  const directory = await mkdtemp(join(tmpdir(), "memory-archive-worker-"));
  const store = new ArchiveArtifactStore(new LocalStorageAdapter(directory));
  let captureUpdate: Parameters<CapturePersistence["updateCapture"]>[1] | undefined;
  const persistence: CapturePersistence = {
    async updateCapture(_captureId, data) {
      captureUpdate = data;
    },
    async updatePlatformLink() {}
  };

  try {
    const result = await persistCaptureResponse(
      { sourceId: "source-2", url: "https://example.org/missing" },
      "capture-2",
      new Response("not found", { headers: { "content-type": "text/plain" }, status: 404 }),
      { store, persistence, saveWayback: async () => null }
    );

    assert.equal(result.ok, false);
    assert.equal(captureUpdate?.captureStatus, "FAILED");
    assert.equal(captureUpdate?.errorMessage, "HTTP 404");
    assert.equal(captureUpdate?.artifactContentType, "text/plain; charset=utf-8");
    assert.ok(await store.get(result.objectKey as string));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
