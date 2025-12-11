import prisma from "@/lib/prisma";
import { normalizeVector } from "@/lib/vertex";

const DECLARED_INTEREST_WEIGHT = 7.0; // very strong signal
const RECENT_INTERACTIONS = 100;

export async function updateUserTasteEmbedding(userId: string): Promise<void> {
  try {
    // 1. Get recent interactions (same logic as post rec, but more items for better average)
    const interactions = await prisma.post.findMany({
      where: {
        OR: [
          { likes: { some: { userId } } },
          { comments: { some: { userId } } },
          { bookmarks: { some: { userId } } },
        ],
      },
      include: {
        likes: { where: { userId }, select: { userId: true } },
        comments: { where: { userId }, select: { userId: true } },
        bookmarks: { where: { userId }, select: { userId: true } },
      },
      orderBy: { createdAt: "desc" },
      take: RECENT_INTERACTIONS,
    });

    // 2. Get declared interests (manual profile ones)
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    const allVectors: number[][] = [];
    const weights: number[] = [];

    // Add behavioral signal (per-post average → fixes multi-topic bias)
    for (const post of interactions) {
      const postEmbs = (post as any).topicEmbeddings as number[][] | undefined;
      if (!postEmbs || postEmbs.length === 0) continue;

      const postWeight =
        (post.likes.length > 0 ? 1.0 : 0) +
        (post.comments.length > 0 ? 1.5 : 0) +
        (post.bookmarks.length > 0 ? 2.0 : 0);

      if (postWeight === 0) continue;

      // Average embedding of this post's topics
      const dim = postEmbs[0].length;
      const avg = Array(dim).fill(0);
      postEmbs.forEach((emb) => {
        emb.forEach((v, i) => (avg[i] += v / postEmbs.length));
      });

      allVectors.push(avg);
      weights.push(postWeight);
    }

    // Add declared interests with very high weight (so manual choices always matter)
    const userTopicEmbeddings = (user as any)?.topicEmbeddings;
    if (userTopicEmbeddings && (userTopicEmbeddings as any[]).length > 0) {
      const declaredEmbs = userTopicEmbeddings as number[][];
      const dim = declaredEmbs[0].length;
      const avg = Array(dim).fill(0);
      declaredEmbs.forEach((emb) => {
        emb.forEach((v, i) => (avg[i] += v / declaredEmbs.length));
      });
      allVectors.push(avg);
      weights.push(DECLARED_INTEREST_WEIGHT);
    }

    // If nothing at all (no interactions AND no declared interests) → skip update to preserve onboarding embedding
    if (allVectors.length === 0) {
      console.log(
        "[RECOMMENDATION] No vectors to update, preserving existing tasteEmbedding"
      );
      return;
    }

    // Weighted average + normalize
    const totalWeight = weights.reduce((a, b) => a + b, 0);
    const dim = allVectors[0].length;
    const final = Array(dim).fill(0);
    allVectors.forEach((vec, i) => {
      vec.forEach((v, j) => {
        final[j] += v * (weights[i] / totalWeight);
      });
    });

    const normalized = normalizeVector(final);
    const vectorStr = `[${normalized.join(",")}]`;

    await prisma.$executeRaw`
      UPDATE users 
      SET "tasteEmbedding" = ${vectorStr}::vector
      WHERE id = ${userId}
    `;
  } catch (error) {
    console.error("Failed to update taste embedding:", error);
    // silent fail - never break UX
  }
}
