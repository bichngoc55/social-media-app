-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "vector";

-- CreateEnum
CREATE TYPE "EMOTION" AS ENUM ('POSITIVE', 'NEGATIVE', 'NEUTRAL');

-- AlterTable
ALTER TABLE "posts" ADD COLUMN     "embedding" vector(1408),
ADD COLUMN     "emotionScore" DOUBLE PRECISION,
ADD COLUMN     "emotions" "EMOTION",
ADD COLUMN     "hashtags" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "recentEmotion" TEXT,
ADD COLUMN     "userEmbedding" vector(384);
