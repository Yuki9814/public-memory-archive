import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, test } from "node:test";
import {
  ArchiveArtifactStore,
  HTML_ARTIFACT_CONTENT_TYPE,
  LocalStorageAdapter,
  assertSafeObjectKey,
  objectKeyForHash
} from "./index.js";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

test("content-addressed writes are stable and idempotent", async () => {
  const directory = await mkdtemp(join(tmpdir(), "memory-archive-storage-"));
  temporaryDirectories.push(directory);
  const store = new ArchiveArtifactStore(new LocalStorageAdapter(directory));

  const first = await store.putText("<html>same body</html>");
  const second = await store.putText("<html>same body</html>");

  assert.deepEqual(second, first);
  assert.match(first.objectKey, /^sha256\/[a-f0-9]{2}\/[a-f0-9]{64}$/);
  assert.equal(first.contentType, HTML_ARTIFACT_CONTENT_TYPE);
  assert.equal(first.bytes, Buffer.byteLength("<html>same body</html>"));
  assert.equal((await readFile(join(directory, first.objectKey))).toString("utf8"), "<html>same body</html>");
});

test("atomic writes remain readable when repeated concurrently", async () => {
  const directory = await mkdtemp(join(tmpdir(), "memory-archive-storage-"));
  temporaryDirectories.push(directory);
  const store = new ArchiveArtifactStore(new LocalStorageAdapter(directory));
  const writes = await Promise.all(Array.from({ length: 8 }, () => store.putText("concurrent body")));

  assert.equal(new Set(writes.map((item) => item.objectKey)).size, 1);
  const result = await store.get(writes[0]!.objectKey);
  assert.equal(Buffer.from(result!.body).toString("utf8"), "concurrent body");
});

test("object keys reject traversal and non-content-addressed paths", () => {
  assert.throws(() => assertSafeObjectKey("../secret"), /STORAGE_OBJECT_KEY_INVALID/);
  assert.throws(() => assertSafeObjectKey("sha256/aa/../../secret"), /STORAGE_OBJECT_KEY_INVALID/);
  assert.throws(() => assertSafeObjectKey("sha256\\aa\\aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"), /STORAGE_OBJECT_KEY_INVALID/);
  assert.equal(objectKeyForHash("a".repeat(64)), `sha256/aa/${"a".repeat(64)}`);
});

test("integrity mismatch is detected before an artifact is served", async () => {
  const directory = await mkdtemp(join(tmpdir(), "memory-archive-storage-"));
  temporaryDirectories.push(directory);
  const adapter = new LocalStorageAdapter(directory);
  const stored = await adapter.put({ body: Buffer.from("original"), contentType: "text/plain" });
  await import("node:fs/promises").then(({ writeFile }) => writeFile(join(directory, stored.objectKey), "tampered"));

  await assert.rejects(() => adapter.get(stored.objectKey), /STORAGE_INTEGRITY_MISMATCH/);
});

describe("ArchiveArtifactStore", () => {
  test("reads missing artifacts as null", async () => {
    const directory = await mkdtemp(join(tmpdir(), "memory-archive-storage-"));
    temporaryDirectories.push(directory);
    const store = new ArchiveArtifactStore(new LocalStorageAdapter(directory));
    assert.equal(await store.get(objectKeyForHash("b".repeat(64))), null);
  });
});
