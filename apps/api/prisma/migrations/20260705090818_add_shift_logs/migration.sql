-- CreateEnum
CREATE TYPE "Shift" AS ENUM ('MORNING', 'EVENING');

-- CreateTable
CREATE TABLE "shift_logs" (
    "id" TEXT NOT NULL,
    "kitchen_id" TEXT NOT NULL,
    "author_id" TEXT NOT NULL,
    "shift" "Shift" NOT NULL,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shift_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "shift_logs_kitchen_id_idx" ON "shift_logs"("kitchen_id");

-- CreateIndex
CREATE INDEX "shift_logs_author_id_idx" ON "shift_logs"("author_id");

-- AddForeignKey
ALTER TABLE "shift_logs" ADD CONSTRAINT "shift_logs_kitchen_id_fkey" FOREIGN KEY ("kitchen_id") REFERENCES "kitchens"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_logs" ADD CONSTRAINT "shift_logs_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
