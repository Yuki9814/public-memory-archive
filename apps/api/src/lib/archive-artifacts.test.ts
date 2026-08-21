import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { test } from "node:test";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { prisma } from "@memory-archive/db";
import { ArchiveArtifactStore, LocalStorageAdapter } from "@memory-archive/storage";
import { buildApp } from "../app.js";
import { archiveArtifactPath, canServePublicArchiveCapture } from "./archive-artifacts.js";

test("archive artifact URLs are opaque API paths", () => {
  assert.equal(archiveArtifactPath("cap/with spaces"), "/api/archive/captures/cap%2Fwith%20spaces");
});

test("only successful artifacts belonging to published events are public", () => {
  const base = {
    editorialStatus: "PUBLISHED",
    captureStatus: "SUCCEEDED",
    artifactKey: "sha256/aa/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
  };

  assert.equal(canServePublicArchiveCapture(base), true);
  assert.equal(canServePublicArchiveCapture({ ...base, editorialStatus: "DRAFT" }), false);
  assert.equal(canServePublicArchiveCapture({ ...base, captureStatus: "FAILED" }), false);
  assert.equal(canServePublicArchiveCapture({ ...base, artifactKey: null }), false);
});

test("public archive route serves published artifacts and hides drafts", async () => {
  const directory = await mkdtemp(join(tmpdir(), "memory-archive-api-"));
  const previousStorageDir = process.env.STORAGE_LOCAL_DIR;
  process.env.STORAGE_LOCAL_DIR = directory;
  const stored = await new ArchiveArtifactStore(new LocalStorageAdapter(directory)).putText("<html>published</html>");
  const originalFindUnique = prisma.archiveCapture.findUnique;
  prisma.archiveCapture.findUnique = (async ({ where }: { where: { id: string } }) => {
    const editorialStatus = where.id === "published" ? "PUBLISHED" : where.id === "draft" ? "DRAFT" : null;
    if (!editorialStatus) return null;
    return {
      id: where.id,
      artifactKey: stored.objectKey,
      artifactContentType: stored.contentType,
      artifactBytes: stored.bytes,
      contentHash: stored.contentHash,
      captureStatus: "SUCCEEDED",
      source: { event: { editorialStatus } }
    };
  }) as unknown as typeof originalFindUnique;

  const app = await buildApp();
  try {
    const published = await app.inject({ method: "GET", url: "/api/archive/captures/published" });
    assert.equal(published.statusCode, 200);
    assert.equal(published.body, "<html>published</html>");
    assert.equal(published.headers["content-type"], "text/html; charset=utf-8");

    const draft = await app.inject({ method: "GET", url: "/api/archive/captures/draft" });
    assert.equal(draft.statusCode, 404);
    assert.equal(draft.json().error, "ARCHIVE_ARTIFACT_NOT_FOUND");
  } finally {
    await app.close();
    prisma.archiveCapture.findUnique = originalFindUnique;
    if (previousStorageDir === undefined) delete process.env.STORAGE_LOCAL_DIR;
    else process.env.STORAGE_LOCAL_DIR = previousStorageDir;
    await rm(directory, { recursive: true, force: true });
  }
});
