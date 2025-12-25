-- AlterTable
ALTER TABLE "users" ADD COLUMN "warningCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "users" ADD COLUMN "bannedUntil" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "user_warnings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "issuedBy" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "deadline" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_warnings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_warnings_userId_idx" ON "user_warnings"("userId");

-- CreateIndex
CREATE INDEX "user_warnings_createdAt_idx" ON "user_warnings"("createdAt");

-- AddForeignKey
ALTER TABLE "user_warnings" ADD CONSTRAINT "user_warnings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_warnings" ADD CONSTRAINT "user_warnings_issuedBy_fkey" FOREIGN KEY ("issuedBy") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;


