-- CreateEnum
CREATE TYPE "ModerationSource" AS ENUM ('AI', 'USER_REPORT', 'ADMIN_MANUAL');

-- CreateEnum
CREATE TYPE "ModerationSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "ModerationAutoAction" AS ENUM ('NONE', 'BLUR', 'REDUCE_DISTRIBUTION', 'TEMP_REMOVE', 'AUTO_REMOVE');

-- CreateEnum
CREATE TYPE "ModerationStatus" AS ENUM ('DETECTED', 'QUEUED', 'IN_REVIEW', 'CONFIRMED', 'RESTORED', 'DISMISSED', 'ESCALATED', 'APPEALED');

-- CreateEnum
CREATE TYPE "ModerationDecision" AS ENUM ('CONFIRM_VIOLATION', 'RESTORE', 'DISMISS', 'ESCALATE', 'NEED_MORE_CONTEXT');

-- CreateEnum
CREATE TYPE "ModerationPolicyArea" AS ENUM ('NUDITY', 'VIOLENCE', 'HATE_SPEECH', 'HARASSMENT', 'SELF_HARM', 'SPAM', 'SCAM', 'COPYRIGHT', 'IMPERSONATION', 'OTHER');

-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'SUPERVISOR';

-- CreateTable
CREATE TABLE "moderation_cases" (
    "id" TEXT NOT NULL,
    "postId" TEXT,
    "userId" TEXT,
    "source" "ModerationSource" NOT NULL DEFAULT 'AI',
    "policyAreaPredicted" "ModerationPolicyArea",
    "confidence" DOUBLE PRECISION,
    "severity" "ModerationSeverity" NOT NULL DEFAULT 'MEDIUM',
    "modelVersion" TEXT,
    "harmfulTypes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "autoAction" "ModerationAutoAction" NOT NULL DEFAULT 'NONE',
    "autoActionAppliedAt" TIMESTAMP(3),
    "status" "ModerationStatus" NOT NULL DEFAULT 'DETECTED',
    "priorityScore" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "assignedTo" TEXT,
    "slaDueAt" TIMESTAMP(3),
    "decision" "ModerationDecision",
    "decisionAt" TIMESTAMP(3),
    "decisionBy" TEXT,
    "policyArea" "ModerationPolicyArea",
    "reasonCode" TEXT,
    "supervisorApproved" BOOLEAN NOT NULL DEFAULT false,
    "supervisorApprovedBy" TEXT,
    "supervisorApprovedAt" TIMESTAMP(3),
    "evidence" JSONB,
    "adminNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "moderation_cases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "moderation_audit_logs" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "actorRole" "UserRole" NOT NULL,
    "previousState" JSONB,
    "newState" JSONB,
    "reason" TEXT,
    "policyArea" "ModerationPolicyArea",
    "modelVersion" TEXT,
    "confidence" DOUBLE PRECISION,
    "evidenceHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "moderation_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "moderation_cases_status_priorityScore_idx" ON "moderation_cases"("status", "priorityScore" DESC);

-- CreateIndex
CREATE INDEX "moderation_cases_assignedTo_status_idx" ON "moderation_cases"("assignedTo", "status");

-- CreateIndex
CREATE INDEX "moderation_cases_postId_idx" ON "moderation_cases"("postId");

-- CreateIndex
CREATE INDEX "moderation_cases_userId_idx" ON "moderation_cases"("userId");

-- CreateIndex
CREATE INDEX "moderation_cases_slaDueAt_idx" ON "moderation_cases"("slaDueAt");

-- CreateIndex
CREATE INDEX "moderation_cases_source_status_idx" ON "moderation_cases"("source", "status");

-- CreateIndex
CREATE INDEX "moderation_audit_logs_caseId_createdAt_idx" ON "moderation_audit_logs"("caseId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "moderation_audit_logs_actorId_idx" ON "moderation_audit_logs"("actorId");

-- AddForeignKey
ALTER TABLE "moderation_cases" ADD CONSTRAINT "moderation_cases_postId_fkey" FOREIGN KEY ("postId") REFERENCES "posts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "moderation_cases" ADD CONSTRAINT "moderation_cases_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "moderation_cases" ADD CONSTRAINT "moderation_cases_assignedTo_fkey" FOREIGN KEY ("assignedTo") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "moderation_cases" ADD CONSTRAINT "moderation_cases_decisionBy_fkey" FOREIGN KEY ("decisionBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "moderation_cases" ADD CONSTRAINT "moderation_cases_supervisorApprovedBy_fkey" FOREIGN KEY ("supervisorApprovedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "moderation_audit_logs" ADD CONSTRAINT "moderation_audit_logs_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "moderation_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

