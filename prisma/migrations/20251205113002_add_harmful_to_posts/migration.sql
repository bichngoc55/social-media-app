/*
  Warnings:

  - You are about to drop the column `harmfulTypes` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `isHarmful` on the `users` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "posts" ADD COLUMN     "harmful" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "harmfulTypes" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "users" DROP COLUMN "harmfulTypes",
DROP COLUMN "isHarmful";
