import { validateRequest } from "@/auth";
import prisma from "@/lib/prisma";
import { getPostDataInclude } from "@/lib/types";
import { NextResponse } from "next/server";

export const maxDuration = 30;

export async function GET() {
  try {
    const { user: authUser } = await validateRequest();
    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userWithEmbedding = await prisma.$queryRaw<
      Array<{
        tasteEmbedding: string | null;
        interests: string[];
        dislikedEmbeddings: string[] | null;
        dislikedTopics: string[] | null;
      }>
    >`
      SELECT "tasteEmbedding"::text as "tasteEmbedding", interests, "dislikedPostTopicsEmbedding"::text[] as "dislikedEmbeddings", "dislikedTopics"
      FROM users
      WHERE id = ${authUser.id}
    `;

    if (!userWithEmbedding || userWithEmbedding.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const user = await prisma.user.findUnique({
      where: { id: authUser.id },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const {
      tasteEmbedding: tasteStr,
      dislikedEmbeddings: dislikedStrArr,
      dislikedTopics: dislikedTopicsArr,
    } = userWithEmbedding[0];

    // Parse Taste Embedding
    let tasteEmbedding: number[] | null = null;
    if (tasteStr) {
      tasteEmbedding = tasteStr.slice(1, -1).split(",").map(parseFloat);
    }

    if (!tasteEmbedding || tasteEmbedding.length === 0) {
      console.log("[RECOMMEND-POSTS] No tasteEmbedding, using fallback");
      // Get blocked users for fallback query
      const blockedUsers = await prisma.userBlock.findMany({
        where: { blockerId: user.id },
        select: { blockedId: true },
      });
      const blockedUserIds = blockedUsers.map((b) => b.blockedId);

      const fallbackPosts = await prisma.post.findMany({
        where: {
          privacy: "PUBLIC",
          userId: { not: user.id, notIn: blockedUserIds },
        },
        include: getPostDataInclude(user.id, true),
        take: 25,
        orderBy: { createdAt: "desc" },
      });

      return NextResponse.json({
        posts: fallbackPosts,
        message: "Welcome! Showing recent posts while we learn your taste.",
      });
    }

    const userTasteStr = `[${tasteEmbedding.join(",")}]`;
    const userGeneralEmotion = user.generalEmotion || "NEUTRAL";

    const recentInteractions = await prisma.post.findMany({
      where: {
        OR: [
          { likes: { some: { userId: user.id } } },
          { comments: { some: { userId: user.id } } },
          { bookmarks: { some: { userId: user.id } } },
        ],
      },
      select: { primaryEmotion: true },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    const emotionFreq: Record<string, number> = {};
    recentInteractions.forEach((p) => {
      if (p.primaryEmotion)
        emotionFreq[p.primaryEmotion] =
          (emotionFreq[p.primaryEmotion] || 0) + 1;
    });

    const preferredEmotions = Object.entries(emotionFreq)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([e]) => e);

    const following = await prisma.follow.findMany({
      where: { followerId: user.id },
      select: { followingId: true },
    });
    const followingIds = following.map((f) => f.followingId);

    // Get blocked users
    const blockedUsers = await prisma.userBlock.findMany({
      where: { blockerId: user.id },
      select: { blockedId: true },
    });
    const blockedUserIds = blockedUsers.map((b) => b.blockedId);

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 20);
    const hasDislikes = dislikedStrArr && dislikedStrArr.length > 0;
    const dislikedVectorSql = hasDislikes ? dislikedStrArr : [];
    const blockedTopicNames = dislikedTopicsArr || [];
    const hasBlockedKeywords = blockedTopicNames.length > 0;

    // const recommendations = await prisma.$queryRaw<
    //   Array<{
    //     id: string;
    //     similarity: number;
    //     emotion_match: number;
    //     hours_old: number;
    //     likes_count: bigint;
    //     final_score: number;
    //   }>
    // >`
    //   WITH post_topic_similarity AS (
    //     SELECT
    //       p.id,
    //       p."userId",
    //       p."createdAt",
    //       p."primaryEmotion",
    //       p.emotions,
    //       p.privacy,
    //       CASE
    //         WHEN p."topicEmbeddings" IS NOT NULL AND array_length(p."topicEmbeddings", 1) > 0
    //         THEN (
    //           SELECT AVG(1 - (topic_emb <=> ${userTasteStr}::vector))
    //           FROM unnest(p."topicEmbeddings") AS topic_emb
    //         )
    //         ELSE 0
    //       END as similarity
    //     FROM posts p
    //     WHERE
    //       p."createdAt" >= ${sevenDaysAgo}
    //       AND p."userId" != ${user.id}
    //       AND p."userId" != ALL(${blockedUserIds}::text[])
    //       AND p.id NOT IN (
    //         SELECT "postId" FROM likes WHERE "userId" = ${user.id}
    //       )
    //       AND (
    //         p.privacy = 'PUBLIC'
    //         OR (p.privacy = 'FOLLOWERS' AND p."userId" = ANY(${followingIds}::text[]))
    //       )
    //   )
    //   SELECT
    //     pts.id,
    //     pts.similarity,
    //     CASE
    //       WHEN pts."primaryEmotion" = ANY(${preferredEmotions}::text[]) THEN 1.0
    //       WHEN pts.emotions::text = ${userGeneralEmotion} THEN 0.5
    //       ELSE 0.0
    //     END as emotion_match,
    //     EXTRACT(EPOCH FROM (NOW() - pts."createdAt")) / 3600 as hours_old,
    //     COUNT(l."userId") as likes_count,
    //     (
    //       pts.similarity * 0.50 +                                      -- Main signal: topic similarity
    //       (CASE
    //         WHEN pts."primaryEmotion" = ANY(${preferredEmotions}::text[]) THEN 1.0
    //         WHEN pts.emotions::text = ${userGeneralEmotion} THEN 0.5
    //         ELSE 0.0
    //       END) * 0.25 +                                               -- Emotion match
    //       (LOG(COUNT(l."userId") + 1) / 8.0) * 0.15 +                  -- Popularity (log scaled)
    //       (1.0 / ((EXTRACT(EPOCH FROM (NOW() - pts."createdAt")) / 3600) + 2)) * 0.10  -- Recency
    //     ) as final_score
    //   FROM post_topic_similarity pts
    //   LEFT JOIN likes l ON pts.id = l."postId"
    //   WHERE pts.similarity > 0
    //   GROUP BY pts.id, pts.similarity, pts."primaryEmotion", pts.emotions, pts."createdAt"
    //   ORDER BY final_score DESC
    //   LIMIT 25
    // `;
    const recommendations = await prisma.$queryRaw<
      Array<{
        id: string;
        similarity: number;
        emotion_match: number;
        likes_count: bigint;
        final_score: number;
      }>
    >`
      WITH post_topic_similarity AS (
        SELECT 
          p.id,
          p."userId",
          p."primaryEmotion",
          p.emotions,
          p.privacy,
          CASE 
            WHEN p."topicEmbeddings" IS NOT NULL AND array_length(p."topicEmbeddings", 1) > 0 
            THEN (
              -- KNN: Exact average distance
              SELECT AVG(1 - (topic_emb <=> ${userTasteStr}::vector))
              FROM unnest(p."topicEmbeddings") AS topic_emb
            )
            ELSE 0
          END as similarity
        FROM posts p
        WHERE 
           p."userId" != ${user.id}
          AND p."userId" != ALL(${blockedUserIds}::text[])
          AND p.id NOT IN (
            SELECT "postId" FROM likes WHERE "userId" = ${user.id}
          )
            AND p.id NOT IN (
             SELECT "postId" FROM post_blocks WHERE "userId" = ${user.id}
          )
          AND (
            p.privacy = 'PUBLIC'
            OR (p.privacy = 'FOLLOWERS' AND p."userId" = ANY(${followingIds}::text[]))
          ) 
            AND (
             -- 1. Check String Block (Exact Match)
             -- If post topics overlap (&&) with blocked names, exclude it.
             ${!hasBlockedKeywords} 
             OR NOT (p.topics && ${blockedTopicNames}::text[])
          )
          AND (
             ${!hasDislikes}  
             OR NOT EXISTS (
               SELECT 1
               FROM unnest(p."topicEmbeddings") AS pt
              CROSS JOIN unnest(${dislikedVectorSql}::text[]::vector[]) AS dt               
              WHERE (1 - (pt <=> dt)) > 0.95
             )
          )
      )
      SELECT 
        pts.id,
        pts.similarity,
        CASE 
          WHEN pts."primaryEmotion" = ANY(${preferredEmotions}::text[]) THEN 1.0
          WHEN pts.emotions::text = ${userGeneralEmotion} THEN 0.5
          ELSE 0.0
        END as emotion_match,
        COUNT(l."userId") as likes_count,
        (
          -- 1. Topic Similarity (60%) - Heavy weight on content match
          pts.similarity * 0.60 + 

          -- 2. Emotion Match (25%) - Medium weight on vibe
          (CASE 
            WHEN pts."primaryEmotion" = ANY(${preferredEmotions}::text[]) THEN 1.0
            WHEN pts.emotions::text = ${userGeneralEmotion} THEN 0.5
            ELSE 0.0
          END) * 0.25 + 

          -- 3. Popularity (15%) - Slight boost for liked posts
          (LOG(COUNT(l."userId") + 1) / 8.0) * 0.15
          
         ) as final_score
      FROM post_topic_similarity pts
      LEFT JOIN likes l ON pts.id = l."postId"
      WHERE pts.similarity > 0
      GROUP BY pts.id, pts.similarity, pts."primaryEmotion", pts.emotions
      ORDER BY final_score DESC
      LIMIT 100
    `;
    const postIds = recommendations.map((r) => r.id);

    if (postIds.length === 0) {
      const fallbackPosts = await prisma.post.findMany({
        where: {
          privacy: "PUBLIC",
          userId: { not: user.id, notIn: blockedUserIds },
          createdAt: { gte: sevenDaysAgo },
        },
        include: getPostDataInclude(user.id, true),
        take: 25,
        orderBy: { createdAt: "desc" },
      });

      return NextResponse.json({
        posts: fallbackPosts,
        message: "Showing recent posts",
      });
    }

    const posts = await prisma.post.findMany({
      where: { id: { in: postIds } },
      include: getPostDataInclude(user.id, true),
      orderBy: { createdAt: "desc" },
    });

    const postMap = new Map(posts.map((p) => [p.id, p]));
    const sortedPosts = recommendations
      .map((rec) => postMap.get(rec.id))
      .filter(Boolean) as any[];

    return NextResponse.json({
      posts: sortedPosts,
      userPreferences: {
        preferredEmotions,
        generalEmotion: userGeneralEmotion,
      },
    });
  } catch (error) {
    console.error("[RECOMMEND-POSTS] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
