-- AlterTable
ALTER TABLE "users" ADD COLUMN     "dislikedTopics" TEXT[] DEFAULT ARRAY[]::TEXT[];
