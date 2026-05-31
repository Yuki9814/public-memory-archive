-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "EditorialStatus" AS ENUM ('DRAFT', 'PENDING_REVIEW', 'PUBLISHED', 'UNPUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "EventProcessStatus" AS ENUM ('UNVERIFIED', 'DEVELOPING', 'PLATFORM_INTERVENED', 'OFFICIAL_INVESTIGATION', 'LEGAL_PROCESS', 'CONCLUDED');

-- CreateEnum
CREATE TYPE "ActorType" AS ENUM ('PERSON', 'ORGANIZATION', 'PLATFORM', 'MEDIA', 'AUTHORITY', 'OTHER');

-- CreateEnum
CREATE TYPE "ActorRole" AS ENUM ('COMPLAINANT', 'RESPONDENT', 'WITNESS', 'PLATFORM', 'OFFICIAL', 'MEDIA', 'THIRD_PARTY', 'OTHER');

-- CreateEnum
CREATE TYPE "PrivacyLevel" AS ENUM ('PUBLIC', 'PSEUDONYMIZED', 'HIGH', 'MINOR_PROTECTED');

-- CreateEnum
CREATE TYPE "SourceType" AS ENUM ('ORIGINAL_POST', 'RESPONSE', 'OFFICIAL_NOTICE', 'MEDIA_REPORT', 'VIDEO', 'NOTE', 'SCREENSHOT', 'DOCUMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "ReliabilityLevel" AS ENUM ('A_STRONG', 'B_DIRECT', 'C_INDIRECT', 'D_WEAK', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "Platform" AS ENUM ('BILIBILI', 'XIAOHONGSHU', 'WEIBO', 'DOUYIN', 'ZHIHU', 'OTHER');

-- CreateEnum
CREATE TYPE "ContentKind" AS ENUM ('VIDEO', 'NOTE', 'POST', 'ARTICLE', 'COMMENT', 'IMAGE', 'OTHER');

-- CreateEnum
CREATE TYPE "AvailabilityStatus" AS ENUM ('AVAILABLE', 'DELETED', 'PRIVATE', 'LOGIN_REQUIRED', 'UNKNOWN', 'ARCHIVED_ONLY');

-- CreateEnum
CREATE TYPE "CaptureStatus" AS ENUM ('QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "ClaimStatus" AS ENUM ('UNVERIFIED', 'INSUFFICIENT_EVIDENCE', 'DISPUTED', 'PARTIALLY_SUPPORTED', 'SUPPORTED', 'REFUTED');

-- CreateEnum
CREATE TYPE "ClaimImportance" AS ENUM ('KEY', 'CONTEXT', 'LOW');

-- CreateEnum
CREATE TYPE "EvidenceKind" AS ENUM ('DOCUMENT', 'SCREENSHOT', 'VIDEO', 'AUDIO', 'POST', 'COMMENT', 'ARTICLE', 'ARCHIVE_CAPTURE', 'OTHER');

-- CreateEnum
CREATE TYPE "RelationType" AS ENUM ('SUPPORTS', 'OPPOSES', 'NEUTRAL', 'COMPLICATES');

-- CreateEnum
CREATE TYPE "CorrectionStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'RESOLVED');

-- CreateEnum
CREATE TYPE "ReportType" AS ENUM ('PRIVACY_LEAK', 'DOXXING', 'DEFAMATION_RISK', 'MINOR_INFO', 'HARASSMENT', 'COPYRIGHT', 'OTHER');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('PENDING', 'TRIAGED', 'RESOLVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "SubmissionStatus" AS ENUM ('PENDING', 'REVIEWED', 'ACCEPTED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ReviewTaskStatus" AS ENUM ('OPEN', 'IN_REVIEW', 'APPROVED', 'CHANGES_REQUESTED', 'CLOSED');

-- CreateEnum
CREATE TYPE "TaskType" AS ENUM ('CAPTURE_SOURCE', 'RECAPTURE_LINK', 'CHECK_LINK', 'WAYBACK_SAVE', 'HASH_ARCHIVE', 'OTHER');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('QUEUED', 'ACTIVE', 'COMPLETED', 'FAILED', 'CANCELED');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'EDITOR', 'REVIEWER', 'VIEWER');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('CREATED', 'UPDATED', 'REVIEW_REQUESTED', 'PUBLISHED', 'UNPUBLISHED', 'CAPTURE_REQUESTED', 'REPORT_RESOLVED', 'AI_SUGGESTED');

-- CreateTable
CREATE TABLE "events" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "neutral_title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "editorial_status" "EditorialStatus" NOT NULL DEFAULT 'DRAFT',
    "event_process_status" "EventProcessStatus" NOT NULL DEFAULT 'UNVERIFIED',
    "occurred_at" TIMESTAMP(3),
    "first_published_at" TIMESTAMP(3),
    "correction_enabled" BOOLEAN NOT NULL DEFAULT true,
    "report_enabled" BOOLEAN NOT NULL DEFAULT true,
    "what_we_know" JSONB NOT NULL DEFAULT '[]',
    "what_is_disputed" JSONB NOT NULL DEFAULT '[]',
    "what_not_to_infer" JSONB NOT NULL DEFAULT '[]',
    "latest_updates" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "topic_id" TEXT,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "actors" (
    "id" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "legal_name" TEXT,
    "actor_type" "ActorType" NOT NULL DEFAULT 'PERSON',
    "privacy_level" "PrivacyLevel" NOT NULL DEFAULT 'PSEUDONYMIZED',
    "privacy_note" TEXT,
    "is_minor" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "actors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_actors" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "actor_id" TEXT NOT NULL,
    "role" "ActorRole" NOT NULL,
    "display_name_override" TEXT,
    "involvement_summary" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "event_actors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sources" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT,
    "source_type" "SourceType" NOT NULL DEFAULT 'OTHER',
    "reliability_level" "ReliabilityLevel" NOT NULL DEFAULT 'UNKNOWN',
    "publisher" TEXT,
    "author_display" TEXT,
    "published_at" TIMESTAMP(3),
    "summary" TEXT NOT NULL,
    "source_hash" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "source_platform_links" (
    "id" TEXT NOT NULL,
    "source_id" TEXT NOT NULL,
    "platform" "Platform" NOT NULL,
    "content_kind" "ContentKind" NOT NULL,
    "original_url" TEXT NOT NULL,
    "canonical_url" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "author_display" TEXT,
    "thumbnail_url" TEXT,
    "published_at" TIMESTAMP(3),
    "captured_at" TIMESTAMP(3),
    "availability_status" "AvailabilityStatus" NOT NULL DEFAULT 'UNKNOWN',
    "engagement_snapshot" JSONB,
    "archive_url" TEXT,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "source_platform_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "archive_captures" (
    "id" TEXT NOT NULL,
    "source_id" TEXT NOT NULL,
    "platform_link_id" TEXT,
    "task_id" TEXT,
    "original_url" TEXT NOT NULL,
    "final_url" TEXT,
    "screenshot_url" TEXT,
    "html_snapshot_url" TEXT,
    "wayback_url" TEXT,
    "content_hash" TEXT,
    "capture_status" "CaptureStatus" NOT NULL DEFAULT 'QUEUED',
    "error_message" TEXT,
    "captured_at" TIMESTAMP(3),
    "next_recapture_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "archive_captures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "timeline_entries" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "source_id" TEXT,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "happened_at" TIMESTAMP(3) NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "timeline_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "claims" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "claimant_actor_id" TEXT,
    "source_id" TEXT,
    "title" TEXT NOT NULL,
    "statement" TEXT NOT NULL,
    "status" "ClaimStatus" NOT NULL DEFAULT 'UNVERIFIED',
    "importance" "ClaimImportance" NOT NULL DEFAULT 'CONTEXT',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "claims_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evidence_items" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "source_id" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "evidence_kind" "EvidenceKind" NOT NULL DEFAULT 'OTHER',
    "reliability_level" "ReliabilityLevel" NOT NULL DEFAULT 'UNKNOWN',
    "storage_url" TEXT,
    "external_url" TEXT,
    "captured_at" TIMESTAMP(3),
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "evidence_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "claim_evidence_links" (
    "id" TEXT NOT NULL,
    "claim_id" TEXT NOT NULL,
    "evidence_id" TEXT NOT NULL,
    "relation_type" "RelationType" NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "claim_evidence_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_versions" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "version_number" INTEGER NOT NULL,
    "snapshot_before" JSONB NOT NULL,
    "snapshot_after" JSONB NOT NULL,
    "change_summary" TEXT NOT NULL,
    "created_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "corrections" (
    "id" TEXT NOT NULL,
    "event_id" TEXT,
    "source_id" TEXT,
    "email" TEXT,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" "CorrectionStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "corrections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reports" (
    "id" TEXT NOT NULL,
    "event_id" TEXT,
    "source_id" TEXT,
    "platform_link_id" TEXT,
    "report_type" "ReportType" NOT NULL DEFAULT 'OTHER',
    "reporter_email" TEXT,
    "body" TEXT NOT NULL,
    "status" "ReportStatus" NOT NULL DEFAULT 'PENDING',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "resolution_notes" TEXT,
    "resolved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "topics" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "topics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tags" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_tags" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "tag_id" TEXT NOT NULL,

    CONSTRAINT "event_tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "submissions" (
    "id" TEXT NOT NULL,
    "event_id" TEXT,
    "email" TEXT,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "source_url" TEXT,
    "status" "SubmissionStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review_tasks" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "assigned_to_user_id" TEXT,
    "status" "ReviewTaskStatus" NOT NULL DEFAULT 'OPEN',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "review_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tasks" (
    "id" TEXT NOT NULL,
    "type" "TaskType" NOT NULL,
    "status" "TaskStatus" NOT NULL DEFAULT 'QUEUED',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "subject_type" TEXT,
    "subject_id" TEXT,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "result" JSONB,
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'EDITOR',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "editor_notes" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "user_id" TEXT,
    "body" TEXT NOT NULL,
    "visibility" TEXT NOT NULL DEFAULT 'INTERNAL',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "editor_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "action" "AuditAction" NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "events_slug_key" ON "events"("slug");

-- CreateIndex
CREATE INDEX "events_editorial_status_idx" ON "events"("editorial_status");

-- CreateIndex
CREATE INDEX "events_event_process_status_idx" ON "events"("event_process_status");

-- CreateIndex
CREATE INDEX "events_occurred_at_idx" ON "events"("occurred_at");

-- CreateIndex
CREATE INDEX "actors_privacy_level_idx" ON "actors"("privacy_level");

-- CreateIndex
CREATE INDEX "event_actors_actor_id_idx" ON "event_actors"("actor_id");

-- CreateIndex
CREATE UNIQUE INDEX "event_actors_event_id_actor_id_role_key" ON "event_actors"("event_id", "actor_id", "role");

-- CreateIndex
CREATE INDEX "sources_event_id_idx" ON "sources"("event_id");

-- CreateIndex
CREATE INDEX "sources_reliability_level_idx" ON "sources"("reliability_level");

-- CreateIndex
CREATE INDEX "source_platform_links_source_id_idx" ON "source_platform_links"("source_id");

-- CreateIndex
CREATE INDEX "source_platform_links_platform_idx" ON "source_platform_links"("platform");

-- CreateIndex
CREATE INDEX "archive_captures_source_id_idx" ON "archive_captures"("source_id");

-- CreateIndex
CREATE INDEX "archive_captures_task_id_idx" ON "archive_captures"("task_id");

-- CreateIndex
CREATE INDEX "archive_captures_capture_status_idx" ON "archive_captures"("capture_status");

-- CreateIndex
CREATE INDEX "timeline_entries_event_id_happened_at_idx" ON "timeline_entries"("event_id", "happened_at");

-- CreateIndex
CREATE INDEX "timeline_entries_source_id_idx" ON "timeline_entries"("source_id");

-- CreateIndex
CREATE INDEX "claims_event_id_idx" ON "claims"("event_id");

-- CreateIndex
CREATE INDEX "claims_status_idx" ON "claims"("status");

-- CreateIndex
CREATE INDEX "evidence_items_event_id_idx" ON "evidence_items"("event_id");

-- CreateIndex
CREATE INDEX "evidence_items_reliability_level_idx" ON "evidence_items"("reliability_level");

-- CreateIndex
CREATE INDEX "claim_evidence_links_evidence_id_idx" ON "claim_evidence_links"("evidence_id");

-- CreateIndex
CREATE UNIQUE INDEX "claim_evidence_links_claim_id_evidence_id_relation_type_key" ON "claim_evidence_links"("claim_id", "evidence_id", "relation_type");

-- CreateIndex
CREATE INDEX "event_versions_event_id_idx" ON "event_versions"("event_id");

-- CreateIndex
CREATE UNIQUE INDEX "event_versions_event_id_version_number_key" ON "event_versions"("event_id", "version_number");

-- CreateIndex
CREATE INDEX "corrections_event_id_idx" ON "corrections"("event_id");

-- CreateIndex
CREATE INDEX "corrections_status_idx" ON "corrections"("status");

-- CreateIndex
CREATE INDEX "reports_event_id_idx" ON "reports"("event_id");

-- CreateIndex
CREATE INDEX "reports_status_idx" ON "reports"("status");

-- CreateIndex
CREATE UNIQUE INDEX "topics_slug_key" ON "topics"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "tags_slug_key" ON "tags"("slug");

-- CreateIndex
CREATE INDEX "event_tags_tag_id_idx" ON "event_tags"("tag_id");

-- CreateIndex
CREATE UNIQUE INDEX "event_tags_event_id_tag_id_key" ON "event_tags"("event_id", "tag_id");

-- CreateIndex
CREATE INDEX "submissions_event_id_idx" ON "submissions"("event_id");

-- CreateIndex
CREATE INDEX "submissions_status_idx" ON "submissions"("status");

-- CreateIndex
CREATE INDEX "review_tasks_event_id_idx" ON "review_tasks"("event_id");

-- CreateIndex
CREATE INDEX "review_tasks_status_idx" ON "review_tasks"("status");

-- CreateIndex
CREATE INDEX "tasks_status_idx" ON "tasks"("status");

-- CreateIndex
CREATE INDEX "tasks_type_idx" ON "tasks"("type");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "editor_notes_event_id_idx" ON "editor_notes"("event_id");

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_entity_id_idx" ON "audit_logs"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "topics"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_actors" ADD CONSTRAINT "event_actors_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_actors" ADD CONSTRAINT "event_actors_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "actors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sources" ADD CONSTRAINT "sources_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "source_platform_links" ADD CONSTRAINT "source_platform_links_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "sources"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "archive_captures" ADD CONSTRAINT "archive_captures_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "sources"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "archive_captures" ADD CONSTRAINT "archive_captures_platform_link_id_fkey" FOREIGN KEY ("platform_link_id") REFERENCES "source_platform_links"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "archive_captures" ADD CONSTRAINT "archive_captures_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timeline_entries" ADD CONSTRAINT "timeline_entries_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timeline_entries" ADD CONSTRAINT "timeline_entries_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "sources"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "claims" ADD CONSTRAINT "claims_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "claims" ADD CONSTRAINT "claims_claimant_actor_id_fkey" FOREIGN KEY ("claimant_actor_id") REFERENCES "actors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "claims" ADD CONSTRAINT "claims_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "sources"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence_items" ADD CONSTRAINT "evidence_items_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence_items" ADD CONSTRAINT "evidence_items_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "sources"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "claim_evidence_links" ADD CONSTRAINT "claim_evidence_links_claim_id_fkey" FOREIGN KEY ("claim_id") REFERENCES "claims"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "claim_evidence_links" ADD CONSTRAINT "claim_evidence_links_evidence_id_fkey" FOREIGN KEY ("evidence_id") REFERENCES "evidence_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_versions" ADD CONSTRAINT "event_versions_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_versions" ADD CONSTRAINT "event_versions_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "corrections" ADD CONSTRAINT "corrections_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "corrections" ADD CONSTRAINT "corrections_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "sources"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "sources"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_platform_link_id_fkey" FOREIGN KEY ("platform_link_id") REFERENCES "source_platform_links"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_tags" ADD CONSTRAINT "event_tags_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_tags" ADD CONSTRAINT "event_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_tasks" ADD CONSTRAINT "review_tasks_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_tasks" ADD CONSTRAINT "review_tasks_assigned_to_user_id_fkey" FOREIGN KEY ("assigned_to_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "editor_notes" ADD CONSTRAINT "editor_notes_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "editor_notes" ADD CONSTRAINT "editor_notes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

