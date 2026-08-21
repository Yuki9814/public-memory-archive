import { createHash, randomUUID } from "node:crypto";
import { lstat, mkdir, readFile, realpath, rename, stat, unlink, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const defaultStorageLocalDir = resolve(repositoryRoot, "storage/captures");

export function getStorageLocalDir() {
  const configured = process.env.STORAGE_LOCAL_DIR?.trim();
  if (!configured) return defaultStorageLocalDir;
  return isAbsolute(configured) ? configured : resolve(repositoryRoot, configured);
}

export type StoragePutInput = {
  body: Uint8Array;
  contentType: string;
};

export type StoredArtifact = {
  objectKey: string;
  contentHash: string;
  bytes: number;
  contentType: string;
};

export type StoredArtifactWithBody = Omit<StoredArtifact, "contentType"> & {
  body: Uint8Array;
};

export interface StorageAdapter {
  put(input: StoragePutInput): Promise<StoredArtifact>;
  get(objectKey: string): Promise<StoredArtifactWithBody | null>;
}

export const HTML_ARTIFACT_CONTENT_TYPE = "text/html; charset=utf-8";

const OBJECT_KEY_PATTERN = /^sha256\/[a-f0-9]{2}\/[a-f0-9]{64}$/;

function hashBody(body: Uint8Array) {
  return createHash("sha256").update(body).digest("hex");
}

function normalizeContentType(contentType: string) {
  const normalized = contentType.trim();
  return normalized || "application/octet-stream";
}

export function objectKeyForHash(contentHash: string) {
  if (!/^[a-f0-9]{64}$/.test(contentHash)) {
    throw new Error("STORAGE_CONTENT_HASH_INVALID");
  }
  return `sha256/${contentHash.slice(0, 2)}/${contentHash}`;
}

export function assertSafeObjectKey(objectKey: string) {
  const normalized = objectKey.replaceAll("\\", "/");
  if (normalized !== objectKey || !OBJECT_KEY_PATTERN.test(normalized)) {
    throw new Error("STORAGE_OBJECT_KEY_INVALID");
  }
  const [, shard, contentHash] = normalized.split("/");
  if (!contentHash || shard !== contentHash.slice(0, 2)) {
    throw new Error("STORAGE_OBJECT_KEY_INVALID");
  }
  return normalized;
}

function resolveObjectPath(rootDir: string, objectKey: string) {
  const safeKey = assertSafeObjectKey(objectKey);
  const root = resolve(rootDir);
  const target = resolve(root, ...safeKey.split("/"));
  const relativeTarget = relative(root, target);
  if (!relativeTarget || relativeTarget.startsWith("..") || isAbsolute(relativeTarget)) {
    throw new Error("STORAGE_OBJECT_KEY_INVALID");
  }
  return target;
}

async function assertResolvedParentWithinRoot(rootDir: string, targetPath: string) {
  const [resolvedRoot, resolvedParent] = await Promise.all([
    realpath(rootDir),
    realpath(dirname(targetPath))
  ]);
  const relativeParent = relative(resolvedRoot, resolvedParent);
  if (relativeParent.startsWith("..") || isAbsolute(relativeParent)) {
    throw new Error("STORAGE_OBJECT_PATH_ESCAPES_ROOT");
  }
}

async function assertTargetIsNotSymlink(targetPath: string) {
  try {
    if ((await lstat(targetPath)).isSymbolicLink()) {
      throw new Error("STORAGE_OBJECT_SYMLINK_BLOCKED");
    }
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? error.code : undefined;
    if (code !== "ENOENT") throw error;
  }
}

export class LocalStorageAdapter implements StorageAdapter {
  private readonly rootDir: string;

  constructor(rootDir: string) {
    this.rootDir = resolve(rootDir);
  }

  async put(input: StoragePutInput): Promise<StoredArtifact> {
    const body = Buffer.from(input.body);
    const contentHash = hashBody(body);
    const objectKey = objectKeyForHash(contentHash);
    const targetPath = resolveObjectPath(this.rootDir, objectKey);
    const contentType = normalizeContentType(input.contentType);

    await mkdir(dirname(targetPath), { recursive: true });
    await assertResolvedParentWithinRoot(this.rootDir, targetPath);
    await assertTargetIsNotSymlink(targetPath);

    try {
      const existing = await readFile(targetPath);
      if (hashBody(existing) === contentHash) {
        return { objectKey, contentHash, bytes: existing.byteLength, contentType };
      }
    } catch (error) {
      const code = error && typeof error === "object" && "code" in error ? error.code : undefined;
      if (code !== "ENOENT") throw error;
    }

    const temporaryPath = `${targetPath}.${randomUUID()}.tmp`;
    try {
      await writeFile(temporaryPath, body, { flag: "wx" });
      await rename(temporaryPath, targetPath);
    } finally {
      await unlink(temporaryPath).catch(() => undefined);
    }

    return { objectKey, contentHash, bytes: body.byteLength, contentType };
  }

  async get(objectKey: string): Promise<StoredArtifactWithBody | null> {
    const targetPath = resolveObjectPath(this.rootDir, objectKey);
    let body: Buffer;
    try {
      await assertResolvedParentWithinRoot(this.rootDir, targetPath);
      await assertTargetIsNotSymlink(targetPath);
      body = await readFile(targetPath);
    } catch (error) {
      const code = error && typeof error === "object" && "code" in error ? error.code : undefined;
      if (code === "ENOENT") return null;
      throw error;
    }

    const contentHash = hashBody(body);
    const expectedHash = objectKey.split("/").at(-1);
    if (expectedHash !== contentHash) {
      throw new Error("STORAGE_INTEGRITY_MISMATCH");
    }

    const fileStats = await stat(targetPath);
    return {
      objectKey,
      contentHash,
      bytes: fileStats.size,
      body
    };
  }
}

export class ArchiveArtifactStore {
  constructor(private readonly adapter: StorageAdapter) {}

  async put(input: StoragePutInput) {
    return this.adapter.put(input);
  }

  async putText(body: string, contentType = HTML_ARTIFACT_CONTENT_TYPE) {
    return this.put({ body: Buffer.from(body, "utf8"), contentType });
  }

  async get(objectKey: string) {
    return this.adapter.get(objectKey);
  }
}
