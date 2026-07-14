-- AlterEnum
ALTER TYPE "InviteStatus" ADD VALUE 'REVOKED';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "is_active" BOOLEAN NOT NULL DEFAULT true;
