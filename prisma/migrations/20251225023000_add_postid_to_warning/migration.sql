-- AlterTable
ALTER TABLE "user_warnings" ADD COLUMN "postId" TEXT;

-- CreateIndex
CREATE INDEX "user_warnings_postId_idx" ON "user_warnings"("postId");

-- AddForeignKey
ALTER TABLE "user_warnings" ADD CONSTRAINT "user_warnings_postId_fkey" FOREIGN KEY ("postId") REFERENCES "posts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

