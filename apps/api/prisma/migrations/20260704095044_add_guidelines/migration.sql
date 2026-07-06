-- CreateEnum
CREATE TYPE "GuidelineType" AS ENUM ('SOP', 'CHECKLIST');

-- CreateTable
CREATE TABLE "guidelines" (
    "id" TEXT NOT NULL,
    "kitchen_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" "GuidelineType" NOT NULL,
    "steps" TEXT[],
    "attachments" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "guidelines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "guidelines_kitchen_id_idx" ON "guidelines"("kitchen_id");

-- AddForeignKey
ALTER TABLE "guidelines" ADD CONSTRAINT "guidelines_kitchen_id_fkey" FOREIGN KEY ("kitchen_id") REFERENCES "kitchens"("id") ON DELETE CASCADE ON UPDATE CASCADE;
