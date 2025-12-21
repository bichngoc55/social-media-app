-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'REPLY';
ALTER TYPE "NotificationType" ADD VALUE 'APPEAL_RESPONSE';
ALTER TYPE "NotificationType" ADD VALUE 'RESOLVED_REPORT';
ALTER TYPE "NotificationType" ADD VALUE 'VIOLATE_COUNTS_RESPONSE';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "totalViolateCounts" INTEGER NOT NULL DEFAULT 0;
