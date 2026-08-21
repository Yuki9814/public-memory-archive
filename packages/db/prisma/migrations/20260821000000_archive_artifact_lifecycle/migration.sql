ALTER TABLE "archive_captures" ADD COLUMN "artifact_key" TEXT;
ALTER TABLE "archive_captures" ADD COLUMN "artifact_content_type" TEXT;
ALTER TABLE "archive_captures" ADD COLUMN "artifact_bytes" INTEGER;

CREATE INDEX "archive_captures_artifact_key_idx" ON "archive_captures"("artifact_key");
