/*
  Warnings:

  - The `recentEmotion` column on the `users` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "users" ADD COLUMN     "emotionScore" DOUBLE PRECISION,
ADD COLUMN     "generalEmotion" "EMOTION",
DROP COLUMN "recentEmotion",
ADD COLUMN     "recentEmotion" "EMOTION";
