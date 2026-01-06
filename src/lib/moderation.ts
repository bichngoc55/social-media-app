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
  const normalized = harmfulType.toUpperCase().trim();

  // Map Vertex AI harmful types to ModerationPolicyArea enum
  // Vertex AI types: VIOLENCE, HATE_SPEECH, NUDITY, SPAM, HARASSMENT, SELF_HARM,
  // SUICIDE, DESPAIR, MISINFORMATION, DANGEROUS_BEHAVIOR, PSYCHOLOGICAL_HARM,
  // MANIPULATION, COMMUNITY_HARM, OTHER
  const mapping: Record<string, ModerationPolicyArea> = {
    // Direct mappings from Vertex AI
    VIOLENCE: ModerationPolicyArea.VIOLENCE,
    HATE_SPEECH: ModerationPolicyArea.HATE_SPEECH,
    NUDITY: ModerationPolicyArea.NUDITY,
    SPAM: ModerationPolicyArea.SPAM,
    HARASSMENT: ModerationPolicyArea.HARASSMENT,
    SELF_HARM: ModerationPolicyArea.SELF_HARM,

    // Map Vertex AI types to closest policy area
    SUICIDE: ModerationPolicyArea.SELF_HARM,
    DESPAIR: ModerationPolicyArea.SELF_HARM,
    MISINFORMATION: ModerationPolicyArea.SCAM,
    DANGEROUS_BEHAVIOR: ModerationPolicyArea.OTHER,
    PSYCHOLOGICAL_HARM: ModerationPolicyArea.HARASSMENT,
    MANIPULATION: ModerationPolicyArea.SCAM,
    COMMUNITY_HARM: ModerationPolicyArea.OTHER,
    OTHER: ModerationPolicyArea.OTHER,
  };

  return mapping[normalized] || ModerationPolicyArea.OTHER;
}

/**
 * Map severity from harmful types
 */
export function determineSeverityFromHarmfulTypes(
  harmfulTypes: string[]
): ModerationSeverity {
  const types = harmfulTypes.map((t) => t.toUpperCase());

  const CRITICAL = ["VIOLENCE", "SELF_HARM", "SUICIDE"];

  const HIGH = [
    "HATE_SPEECH",
    "HARASSMENT",
    "DANGEROUS_BEHAVIOR",
    "PSYCHOLOGICAL_HARM",
  ];

  const MEDIUM = [
    "NUDITY",
    "SPAM",
    "MISINFORMATION",
    "MANIPULATION",
    "COMMUNITY_HARM",
  ];

  if (types.some((t) => CRITICAL.includes(t))) {
    return ModerationSeverity.CRITICAL;
  }

  if (types.some((t) => HIGH.includes(t))) {
    return ModerationSeverity.HIGH;
  }

  if (types.some((t) => MEDIUM.includes(t))) {
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
  console.log(
    "Creating moderation case for post ID:",
    postId,
    "with harmful types:",
    harmfulTypes
  );

  const severity = determineSeverityFromHarmfulTypes(harmfulTypes);
  const policyArea = mapHarmfulTypeToPolicyArea(harmfulTypes[0]);
  console.log("Determined severity:", severity, "and policy area:", policyArea);
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
      status: "QUEUED", // Directly queue for review
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
/**
 * Calculate user violation rate based on posts from last 30 days
 * Only counts QUEUED and IN_REVIEW statuses as active violations
 * DISMISSED, RESTORED, and CONFIRMED are not counted (user already took action)
 */
export async function calculateUserViolationRate(userId: string) {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const totalPosts = await prisma.post.count({
    where: { userId, createdAt: { gte: thirtyDaysAgo } },
  });

  if (totalPosts === 0) return 0;

  // Only count active violations (QUEUED, IN_REVIEW)
  // DISMISSED = user appealed and was cleared
  // RESTORED = admin restored the post
  // CONFIRMED = post was removed (user already took action or admin confirmed)
  const violationCount = await prisma.moderationCase.count({
    where: {
      userId,
      source: "AI",
      status: { in: ["QUEUED", "IN_REVIEW"] },
      createdAt: { gte: thirtyDaysAgo },
    },
  });
  console.log(
    `User ID: ${userId} - Total Posts: ${totalPosts}, Violations: ${violationCount}`
  );

  return (violationCount / totalPosts) * 100;
}
