-- AlterTable
ALTER TABLE "post_media" ADD COLUMN     "commentId" TEXT;

-- AddForeignKey
ALTER TABLE "post_media" ADD CONSTRAINT "post_media_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "comments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
