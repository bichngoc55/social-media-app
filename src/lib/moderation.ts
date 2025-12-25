import prisma from "@/lib/prisma";
import {
  ModerationSeverity,
  ModerationAutoAction,
  ModerationPolicyArea,
  ModerationSource,
} from "@prisma/client";

/**
 * Calculate priority score: severity × virality × confidence
 */
export function calculatePriorityScore(
  severity: ModerationSeverity,
  virality: number, // e.g., likes + comments + shares
  confidence: number // 0.0 - 1.0
): number {
  const severityWeight = {
    LOW: 0.25,
    MEDIUM: 0.5,
    HIGH: 0.75,
    CRITICAL: 1.0,
  };

  // Normalize virality (log scale to prevent extreme values)
  const normalizedVirality = Math.min(1.0, Math.log10(virality + 1) / 3);

  return severityWeight[severity] * normalizedVirality * confidence;
}

/**
 * Determine auto-action based on severity and confidence
 */
export function determineAutoAction(
  severity: ModerationSeverity,
  confidence: number
): ModerationAutoAction {
  // High severity + High confidence → Auto-remove
  if (severity === "CRITICAL" && confidence >= 0.9) {
    return ModerationAutoAction.AUTO_REMOVE;
  }
  if (severity === "HIGH" && confidence >= 0.85) {
    return ModerationAutoAction.TEMP_REMOVE;
  }

  // Medium severity or Medium confidence → Blur/Interstitial + Reduce distribution
  if (severity === "MEDIUM" || (severity === "HIGH" && confidence >= 0.7)) {
    return ModerationAutoAction.BLUR;
  }
  if (severity === "LOW" && confidence >= 0.6) {
    return ModerationAutoAction.REDUCE_DISTRIBUTION;
  }

  // Low confidence → Log only
  return ModerationAutoAction.NONE;
}

/**
 * Map harmful types to policy area
 */
export function mapHarmfulTypeToPolicyArea(
  harmfulType: string
): ModerationPolicyArea {
  const mapping: Record<string, ModerationPolicyArea> = {
    VIOLENCE: ModerationPolicyArea.VIOLENCE,
    HATE_SPEECH: ModerationPolicyArea.HATE_SPEECH,
    NUDITY: ModerationPolicyArea.NUDITY,
    SPAM: ModerationPolicyArea.SPAM,
    HARASSMENT: ModerationPolicyArea.HARASSMENT,
  };

  return mapping[harmfulType.toUpperCase()] || ModerationPolicyArea.OTHER;
}

/**
 * Map severity from harmful types
 */
export function determineSeverityFromHarmfulTypes(
  harmfulTypes: string[]
): ModerationSeverity {
  const criticalTypes = ["VIOLENCE", "SELF_HARM"];
  const highTypes = ["HATE_SPEECH", "HARASSMENT"];
  const mediumTypes = ["NUDITY", "SPAM"];

  if (harmfulTypes.some((t) => criticalTypes.includes(t.toUpperCase()))) {
    return ModerationSeverity.CRITICAL;
  }
  if (harmfulTypes.some((t) => highTypes.includes(t.toUpperCase()))) {
    return ModerationSeverity.HIGH;
  }
  if (harmfulTypes.some((t) => mediumTypes.includes(t.toUpperCase()))) {
    return ModerationSeverity.MEDIUM;
  }

  return ModerationSeverity.LOW;
}

/**
 * Create moderation case from AI detection
 */
export async function createModerationCaseFromAI({
  postId,
  userId,
  harmful,
  harmfulTypes,
  confidence,
  modelVersion = "gemini-1.5-pro",
  postEngagement = { likes: 0, comments: 0, shares: 0 },
}: {
  postId: string;
  userId: string;
  harmful: boolean;
  harmfulTypes: string[];
  confidence?: number;
  modelVersion?: string;
  postEngagement?: { likes: number; comments: number; shares: number };
}) {
  if (!harmful || harmfulTypes.length === 0) {
    return null;
  }

  const severity = determineSeverityFromHarmfulTypes(harmfulTypes);
  const policyArea = mapHarmfulTypeToPolicyArea(harmfulTypes[0]);
  const virality =
    postEngagement.likes + postEngagement.comments + postEngagement.shares;
  const priorityScore = calculatePriorityScore(
    severity,
    virality,
    confidence || 0.7
  );
  const autoAction = determineAutoAction(severity, confidence || 0.7);

  // Calculate SLA (hours until review deadline)
  const slaHours =
    severity === "CRITICAL"
      ? 1
      : severity === "HIGH"
        ? 4
        : severity === "MEDIUM"
          ? 24
          : 72;
  const slaDueAt = new Date();
  slaDueAt.setHours(slaDueAt.getHours() + slaHours);

  // Create evidence snapshot
  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: {
      id: true,
      content: true,
      createdAt: true,
      harmful: true,
      harmfulTypes: true,
    },
  });

  const evidence = {
    postContent: post?.content?.substring(0, 500),
    detectedAt: new Date().toISOString(),
    modelVersion,
    confidence,
    harmfulTypes,
    postSnapshot: post,
  };

  const case_ = await prisma.moderationCase.create({
    data: {
      postId,
      userId,
      source: ModerationSource.AI,
      policyAreaPredicted: policyArea,
      confidence: confidence || 0.7,
      severity,
      modelVersion,
      harmfulTypes,
      autoAction,
      autoActionAppliedAt:
        autoAction !== ModerationAutoAction.NONE ? new Date() : null,
      priorityScore,
      slaDueAt,
      evidence: evidence as any,
      status: "QUEUED", // Auto-queue after detection
    },
  });

  // Apply auto-action if needed
  if (autoAction !== ModerationAutoAction.NONE) {
    await applyAutoAction(postId, autoAction);
  }

  // TODO: Uncomment when ModerationAuditLog model is added to schema
  // Create audit log
  // await prisma.moderationAuditLog.create({
  //   data: {
  //     caseId: case_.id,
  //     actorId: "system",
  //     actorRole: "ADMIN",
  //     action: "CASE_CREATED",
  //     newState: {
  //       status: "DETECTED",
  //       autoAction,
  //       severity,
  //       priorityScore,
  //     },
  //     reason: `AI detected harmful content: ${harmfulTypes.join(", ")}`,
  //     policyArea,
  //     modelVersion,
  //     confidence,
  //   },
  // });

  return case_;
}

/**
 * Apply auto-action to post
 */
async function applyAutoAction(postId: string, action: ModerationAutoAction) {
  // For now, we just mark the post. In production, you might:
  // - BLUR: Set a flag that UI respects
  // - REDUCE_DISTRIBUTION: Lower post score in feed algorithm
  // - TEMP_REMOVE / AUTO_REMOVE: Set visibility flag or actually hide
  // The UI already handles harmful=true with blur, so we don't need to do much here
  // But we could add a moderationVisibility field to Post model if needed
}
