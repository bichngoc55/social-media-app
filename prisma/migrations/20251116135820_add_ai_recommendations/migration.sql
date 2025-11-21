-- CreateTable
CREATE TABLE "user_ai_metrics" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "totalPosts" INTEGER NOT NULL DEFAULT 0,
    "totalLikes" INTEGER NOT NULL DEFAULT 0,
    "totalComments" INTEGER NOT NULL DEFAULT 0,
    "totalFollowers" INTEGER NOT NULL DEFAULT 0,
    "totalFollowing" INTEGER NOT NULL DEFAULT 0,
    "postsLast30Days" INTEGER NOT NULL DEFAULT 0,
    "postsLast7Days" INTEGER NOT NULL DEFAULT 0,
    "isActiveLast7Days" BOOLEAN NOT NULL DEFAULT false,
    "lastPostDate" TIMESTAMP(3),
    "topHashtags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "hashtagCounts" JSONB,
    "engagementRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "avgLikesPerPost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "avgCommentsPerPost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_ai_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_recommendations" (
    "id" TEXT NOT NULL,
    "recommendedToId" TEXT NOT NULL,
    "recommendedUserId" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "reason" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_recommendations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_ai_metrics_userId_key" ON "user_ai_metrics"("userId");

-- CreateIndex
CREATE INDEX "user_ai_metrics_userId_idx" ON "user_ai_metrics"("userId");

-- CreateIndex
CREATE INDEX "user_ai_metrics_updatedAt_idx" ON "user_ai_metrics"("updatedAt");

-- CreateIndex
CREATE INDEX "user_recommendations_recommendedToId_score_idx" ON "user_recommendations"("recommendedToId", "score" DESC);

-- CreateIndex
CREATE INDEX "user_recommendations_recommendedToId_expiresAt_idx" ON "user_recommendations"("recommendedToId", "expiresAt");

-- CreateIndex
CREATE INDEX "user_recommendations_expiresAt_idx" ON "user_recommendations"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "user_recommendations_recommendedToId_recommendedUserId_key" ON "user_recommendations"("recommendedToId", "recommendedUserId");

-- AddForeignKey
ALTER TABLE "user_ai_metrics" ADD CONSTRAINT "user_ai_metrics_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_recommendations" ADD CONSTRAINT "user_recommendations_recommendedToId_fkey" FOREIGN KEY ("recommendedToId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_recommendations" ADD CONSTRAINT "user_recommendations_recommendedUserId_fkey" FOREIGN KEY ("recommendedUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
