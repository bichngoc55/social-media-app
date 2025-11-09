-- AlterTable (only if column doesn't exist)
DO $$ BEGIN
    ALTER TABLE "post_media" ADD COLUMN "commentId" TEXT;
EXCEPTION
    WHEN duplicate_column THEN null;
END $$;

-- AddForeignKey (only if constraint doesn't exist)
DO $$ BEGIN
    ALTER TABLE "post_media" ADD CONSTRAINT "post_media_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "comments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
