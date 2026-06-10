ALTER TABLE "corrections"
  ADD COLUMN "resolution_notes" TEXT,
  ADD COLUMN "resolution_action" TEXT,
  ADD COLUMN "linked_entity_type" TEXT,
  ADD COLUMN "linked_entity_id" TEXT,
  ADD COLUMN "resolved_at" TIMESTAMP(3);

ALTER TABLE "submissions"
  ADD COLUMN "resolution_notes" TEXT,
  ADD COLUMN "resolution_action" TEXT,
  ADD COLUMN "linked_entity_type" TEXT,
  ADD COLUMN "linked_entity_id" TEXT,
  ADD COLUMN "resolved_at" TIMESTAMP(3);
