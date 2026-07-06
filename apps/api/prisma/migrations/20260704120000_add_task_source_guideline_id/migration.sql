-- AlterTable: add nullable source_guideline_id column to tasks.
-- Mirrors the existing (inert) source_recipe_id column: no FK
-- constraint, purely an informational back-reference set at Task
-- generation time. Additive, nullable, fully reversible (DROP COLUMN),
-- no data loss to existing rows.
ALTER TABLE "tasks" ADD COLUMN "source_guideline_id" TEXT;
