-- AlterTable
ALTER TABLE "users" ADD COLUMN     "dislikedPostTopicsEmbedding" vector(768)[];

-- CreateTable
CREATE TABLE "post_blocks" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "post_blocks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "post_blocks_userId_idx" ON "post_blocks"("userId");

-- CreateIndex
CREATE INDEX "post_blocks_postId_idx" ON "post_blocks"("postId");

-- CreateIndex
CREATE UNIQUE INDEX "post_blocks_userId_postId_key" ON "post_blocks"("userId", "postId");

-- AddForeignKey
ALTER TABLE "post_blocks" ADD CONSTRAINT "post_blocks_postId_fkey" FOREIGN KEY ("postId") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_blocks" ADD CONSTRAINT "post_blocks_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
