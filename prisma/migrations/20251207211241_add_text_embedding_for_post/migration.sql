/*
  Warnings:

  - You are about to drop the column `wardCode` on the `users` table. All the data in the column will be lost.

*/
-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "vector";

-- CreateEnum
CREATE TYPE "HARMFULTYPES" AS ENUM ('VIOLENCE', 'HATE_SPEECH', 'NUDITY', 'SPAM', 'HARASSMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "EMOTION" AS ENUM ('POSITIVE', 'NEGATIVE', 'NEUTRAL');

-- AlterTable
ALTER TABLE "posts" ADD COLUMN     "embedding" vector(1408),
ADD COLUMN     "emotionExplanation" TEXT,
ADD COLUMN     "emotionScore" DOUBLE PRECISION,
ADD COLUMN     "emotions" "EMOTION",
ADD COLUMN     "harmful" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "harmfulTypes" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "hashtags" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "primaryEmotion" TEXT,
ADD COLUMN     "topicEmbeddings" vector(768)[],
ADD COLUMN     "topics" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "users" DROP COLUMN "wardCode",
ADD COLUMN     "countryCode" TEXT,
ADD COLUMN     "emotionScore" DOUBLE PRECISION,
ADD COLUMN     "generalEmotion" "EMOTION",
ADD COLUMN     "interests" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "tasteEmbedding" vector(768),
ADD COLUMN     "topicEmbeddings" vector(768)[];
