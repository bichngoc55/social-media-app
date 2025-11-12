-- CreateEnum
CREATE TYPE "MediaLayout" AS ENUM ('GRID', 'SINGLE', 'CAROUSEL', 'STACK', 'MASONRY');

-- AlterTable
ALTER TABLE "posts" ADD COLUMN     "mediaLayout" "MediaLayout";
