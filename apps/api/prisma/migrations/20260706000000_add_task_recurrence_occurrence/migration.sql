-- AlterTable
ALTER TABLE "tasks" ADD COLUMN "recurring_template_id" TEXT;
ALTER TABLE "tasks" ADD COLUMN "occurrence_date" DATE;

-- CreateIndex (unique, backs idempotency: one occurrence per template per day)
CREATE UNIQUE INDEX "tasks_recurring_template_id_occurrence_date_key" ON "tasks"("recurring_template_id", "occurrence_date");

-- AddForeignKey (self-relation: occurrence -> template; SetNull preserves
-- generated occurrence history if a template is ever deleted, matching the
-- append-only-history pattern used elsewhere in this schema)
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_recurring_template_id_fkey" FOREIGN KEY ("recurring_template_id") REFERENCES "tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;
