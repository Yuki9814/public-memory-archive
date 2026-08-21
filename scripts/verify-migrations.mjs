import { cp, mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const baseUrl = process.env.MIGRATION_TEST_DATABASE_URL?.trim();
if (!baseUrl) throw new Error("MIGRATION_TEST_DATABASE_URL is required");

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const prismaRoot = join(repositoryRoot, "packages/db/prisma");
const currentSchema = join(prismaRoot, "schema.prisma");
const currentMigrations = join(prismaRoot, "migrations");
const artifactMigration = "20260821000000_archive_artifact_lifecycle";
const temporaryRoot = await mkdtemp(join(tmpdir(), "memory-archive-migrations-"));
const pnpm = process.platform === "win32" ? "pnpm.cmd" : "pnpm";

function databaseUrl(schema) {
  const url = new URL(baseUrl);
  url.searchParams.set("schema", schema);
  return url.toString();
}

function prisma(args, databaseUrlValue) {
  execFileSync(pnpm, ["exec", "prisma", ...args], {
    cwd: repositoryRoot,
    env: { ...process.env, DATABASE_URL: databaseUrlValue },
    stdio: "inherit"
  });
}

async function executeSql(name, sql, databaseUrlValue) {
  const path = join(temporaryRoot, name);
  await writeFile(path, sql, "utf8");
  prisma(["db", "execute", "--url", databaseUrlValue, "--file", path], databaseUrlValue);
}

const setupUrl = databaseUrl("public");
const freshUrl = databaseUrl("migration_fresh");
const upgradeUrl = databaseUrl("migration_upgrade");

try {
  await executeSql(
    "setup.sql",
    'CREATE SCHEMA IF NOT EXISTS "migration_fresh"; CREATE SCHEMA IF NOT EXISTS "migration_upgrade";',
    setupUrl
  );

  prisma(["migrate", "deploy", "--schema", currentSchema], freshUrl);
  await executeSql(
    "verify-fresh.sql",
    `DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = 'archive_captures'
          AND column_name IN ('artifact_key', 'artifact_content_type', 'artifact_bytes')
        GROUP BY table_name HAVING COUNT(*) = 3
      ) THEN
        RAISE EXCEPTION 'fresh archive artifact columns are missing';
      END IF;
      IF NOT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE schemaname = current_schema()
          AND indexname = 'archive_captures_artifact_key_idx'
      ) THEN
        RAISE EXCEPTION 'fresh artifact key index is missing';
      END IF;
    END $$;`,
    freshUrl
  );

  const legacyRoot = join(temporaryRoot, "legacy-prisma");
  const legacyMigrations = join(legacyRoot, "migrations");
  await mkdir(legacyMigrations, { recursive: true });
  await cp(currentSchema, join(legacyRoot, "schema.prisma"));
  await cp(join(currentMigrations, "migration_lock.toml"), join(legacyMigrations, "migration_lock.toml"));
  for (const entry of await readdir(currentMigrations, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name === artifactMigration) continue;
    await cp(join(currentMigrations, entry.name), join(legacyMigrations, entry.name), { recursive: true });
  }

  prisma(["migrate", "deploy", "--schema", join(legacyRoot, "schema.prisma")], upgradeUrl);
  await executeSql(
    "seed-legacy.sql",
    `INSERT INTO "events" (
       "id", "slug", "title", "neutral_title", "summary", "updated_at"
     ) VALUES ('migration-event', 'migration-event', 'Legacy event', 'Legacy event', 'Legacy summary', CURRENT_TIMESTAMP);
     INSERT INTO "sources" (
       "id", "event_id", "title", "summary", "updated_at"
     ) VALUES ('migration-source', 'migration-event', 'Legacy source', 'Legacy source summary', CURRENT_TIMESTAMP);
     INSERT INTO "archive_captures" (
       "id", "source_id", "original_url", "html_snapshot_url", "capture_status", "updated_at"
     ) VALUES (
       'migration-capture', 'migration-source', 'https://example.org/legacy',
       '/worker/private/legacy.html', 'SUCCEEDED', CURRENT_TIMESTAMP
     );`,
    upgradeUrl
  );
  prisma(["migrate", "deploy", "--schema", currentSchema], upgradeUrl);
  await executeSql(
    "verify-upgrade.sql",
    `DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM "archive_captures"
        WHERE "id" = 'migration-capture'
          AND "html_snapshot_url" = '/worker/private/legacy.html'
          AND "artifact_key" IS NULL
          AND "artifact_content_type" IS NULL
          AND "artifact_bytes" IS NULL
      ) THEN
        RAISE EXCEPTION 'legacy archive capture was not preserved';
      END IF;
      IF NOT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE schemaname = current_schema()
          AND indexname = 'archive_captures_artifact_key_idx'
      ) THEN
        RAISE EXCEPTION 'upgraded artifact key index is missing';
      END IF;
    END $$;`,
    upgradeUrl
  );

  console.log("Fresh and legacy PostgreSQL migration verification passed.");
} finally {
  await rm(temporaryRoot, { recursive: true, force: true });
}
