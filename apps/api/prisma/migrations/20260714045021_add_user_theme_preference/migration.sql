-- CreateEnum
CREATE TYPE "Theme" AS ENUM ('simple', 'dark_neon');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "theme_preference" "Theme" NOT NULL DEFAULT 'simple';
