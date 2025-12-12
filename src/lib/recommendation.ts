import prisma from "@/lib/prisma";
import { normalizeVector } from "@/lib/vertex";
const DECLARED_INTEREST_WEIGHT = 5.0;
const RECENT_INTERACTIONS = 100;

export async function updateUserTasteEmbedding(userId: string): Promise<void> {
  try {
    const interactions = await prisma.post.findMany({
      where: {
        OR: [
          { likes: { some: { userId } } },
          { comments: { some: { userId } } },
          { bookmarks: { some: { userId } } },
        ],
      },
      select: {
        id: true,
        likes: { where: { userId }, select: { userId: true } },
        comments: { where: { userId }, select: { userId: true } },
        bookmarks: { where: { userId }, select: { userId: true } },
      },
      orderBy: { createdAt: "desc" },
      take: RECENT_INTERACTIONS,
    });

    if (interactions.length === 0) return;

    const postIds = interactions.map((p) => p.id);

    const postVectors = await prisma.$queryRaw<
      Array<{ id: string; topicEmbeddings: string[] }>
    >`
      SELECT id, "topicEmbeddings"::text[] as "topicEmbeddings"
      FROM posts
      WHERE id = ANY(${postIds})
    `;

    // Create a Map for O(1) lookup
    const vectorMap = new Map(
      postVectors.map((p) => [p.id, p.topicEmbeddings])
    );

    // 3. Get declared interests (Fetch via Raw SQL for the same reason)
    const userVectorData = await prisma.$queryRaw<
      Array<{ topicEmbeddings: string[] | null }>
    >`
        SELECT "topicEmbeddings"::text[] as "topicEmbeddings" 
        FROM users WHERE id = ${userId}
    `;

    const allVectors: number[][] = [];
    const weights: number[] = [];

    for (const post of interactions) {
      const rawEmbs = vectorMap.get(post.id);

      if (!rawEmbs || rawEmbs.length === 0) continue;

      const postEmbs = rawEmbs.map((str) =>
        str
          .replace(/[\[\]]/g, "")
          .split(",")
          .map(parseFloat)
      );

      const postWeight =
        (post.likes.length > 0 ? 1.0 : 0) +
        (post.comments.length > 0 ? 1.5 : 0) +
        (post.bookmarks.length > 0 ? 2.0 : 0);

      if (postWeight === 0) continue;

      const dim = postEmbs[0].length;
      const avg = Array(dim).fill(0);
      postEmbs.forEach((emb) => {
        emb.forEach((v, i) => (avg[i] += v / postEmbs.length));
      });

      allVectors.push(avg);
      weights.push(postWeight);
    }

    const userRawEmbs = userVectorData[0]?.topicEmbeddings;
    if (userRawEmbs && userRawEmbs.length > 0) {
      const declaredEmbs = userRawEmbs.map((str) =>
        str
          .replace(/[\[\]]/g, "")
          .split(",")
          .map(parseFloat)
      );

      const dim = declaredEmbs[0].length;
      const avg = Array(dim).fill(0);
      declaredEmbs.forEach((emb) => {
        emb.forEach((v, i) => (avg[i] += v / declaredEmbs.length));
      });
      allVectors.push(avg);
      weights.push(DECLARED_INTEREST_WEIGHT);
    }

    console.log(
      `[RECOMMENDATION] Collected ${allVectors.length} vectors for user ${userId}`
    );

    if (allVectors.length === 0) return;

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

    console.log(`[RECOMMENDATION] Successfully updated taste for ${userId}`);
  } catch (error) {
    console.error("Failed to update taste embedding:", error);
  }
}
