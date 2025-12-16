import { validateRequest } from "@/auth";
import prisma from "@/lib/prisma";
import { getUserDataSelect } from "@/lib/types";
import { NextResponse } from "next/server";

export const maxDuration = 30;

export async function GET() {
  try {
    console.log("[RECOMMEND-FRIENDS] API called");
    const { user: authUser } = await validateRequest();
    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const currentUserRaw = await prisma.$queryRaw<
      Array<{
        id: string;
        tasteEmbedding: string | null;
        interests: string[];
        provinceCode: string | null;
        generalEmotion: string | null;
      }>
    >`
      SELECT 
        id, 
        "tasteEmbedding"::text as "tasteEmbedding", 
        interests, 
        "provinceCode", 
        "generalEmotion"
      FROM users
      WHERE id = ${authUser.id}
    `;

    if (!currentUserRaw || currentUserRaw.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    const currentUser = currentUserRaw[0];
    let tasteEmbedding: number[] | null = null;
    if (currentUser.tasteEmbedding) {
      tasteEmbedding = currentUser.tasteEmbedding
        .slice(1, -1)
        .split(",")
        .map((v) => parseFloat(v));
    }

    if (!tasteEmbedding || tasteEmbedding.length === 0) {
      const fallback = await prisma.user.findMany({
        where: {
          id: { not: currentUser.id },
          role: "USER",
          followers: { none: { followerId: currentUser.id } },
          blockedByUsers: { none: { blockerId: currentUser.id } },
        },
        select: getUserDataSelect(currentUser.id, false),
        take: 12,
        orderBy: { createdAt: "desc" },
      });
      return NextResponse.json({
        users: fallback,
        message: "New user fallback",
      });
    }

    const userTasteStr = `[${tasteEmbedding.join(",")}]`;
    const userProvince = currentUser.provinceCode || "";
    const userEmotion = currentUser.generalEmotion || "NEUTRAL";
    const userInterestsSql =
      currentUser.interests.length > 0 ? currentUser.interests : [];
    const recommendations = await prisma.$queryRaw<
      Array<{
        id: string;
        username: string;
        displayName: string;
        avatarUrl: string | null;
        generalEmotion: string | null;
        mutual_friends: bigint;
        shared_interests_count: bigint; // New field for debugging/metadata
        similarity: number;
        final_score: number;
      }>
    >`
      SELECT 
        u.id,
        u.username,
        u."displayName",
        u."avatarUrl",
        u."generalEmotion",
        
        -- 1. Mutual Friends Count
        (
          SELECT COUNT(*)
          FROM follows f1
          JOIN follows f2 ON f1."followingId" = f2."followingId"
          WHERE f1."followerId" = ${authUser.id}
            AND f2."followerId" = u.id
        ) as mutual_friends,

        -- 2. Shared Interests Count (Intersection)
        (
           SELECT COUNT(*)
           FROM unnest(u.interests) AS i
           WHERE i = ANY(${userInterestsSql}::text[])
        ) as shared_interests_count,

        -- 3. Embedding Similarity
        (1 - (u."tasteEmbedding" <=> ${userTasteStr}::vector)) as similarity,

        -- 4. FINAL WEIGHTED SCORE
        (
          -- A. Behavioral Match (40%) - Reduced to make room for interests
          (1 - (u."tasteEmbedding" <=> ${userTasteStr}::vector)) * 0.40 +
          
          -- B. Interest Match (20%) - NEW
          -- Formula: Min(shared_count, 4) / 4.0 * 0.20
          -- If they share 4 or more interests, they get max points for this section.
          (
            LEAST(
              (SELECT COUNT(*) FROM unnest(u.interests) AS i WHERE i = ANY(${userInterestsSql}::text[])), 
              4
            )::float / 4.0
          ) * 0.20 +

          -- C. Social Proof (20%) - Capped at 10 mutual friends
          (LEAST((
            SELECT COUNT(*)
            FROM follows f1
            JOIN follows f2 ON f1."followingId" = f2."followingId"
            WHERE f1."followerId" = ${authUser.id}
              AND f2."followerId" = u.id
          ), 10)::float / 10.0) * 0.20 +

          -- D. Emotion Compatibility (10%)
          (CASE 
            WHEN u."generalEmotion"::text = ${userEmotion} THEN 1.0
            WHEN (u."generalEmotion"::text = 'POSITIVE' AND ${userEmotion} = 'NEUTRAL') 
              OR (u."generalEmotion"::text = 'NEUTRAL' AND ${userEmotion} = 'POSITIVE') THEN 0.6
            ELSE 0.0
          END) * 0.10 +

          -- E. Location (10%)
          (CASE WHEN u."provinceCode" = ${userProvince} THEN 1.0 ELSE 0.0 END) * 0.10 
        ) as final_score

      FROM users u
      WHERE u."tasteEmbedding" IS NOT NULL
        AND u.id != ${authUser.id}
        -- Filter out already followed users
        AND u.id NOT IN (SELECT "followingId" FROM follows WHERE "followerId" = ${authUser.id})
        -- Filter out blocked interactions
        AND u.id NOT IN (SELECT "blockedId" FROM user_blocks WHERE "blockerId" = ${authUser.id})
        AND u.id NOT IN (SELECT "blockerId" FROM user_blocks WHERE "blockedId" = ${authUser.id})
      ORDER BY final_score DESC
      LIMIT 20
    `;

    console.log(
      "[RECOMMEND-FRIENDS] Raw recommendations:",
      recommendations.length
    );
    const userIds = recommendations.map((r) => r.id);

    if (userIds.length === 0) {
      console.log("[RECOMMEND-FRIENDS] Empty recommendations, using fallback");
      const fallback = await prisma.user.findMany({
        where: {
          id: { not: currentUser.id },
          role: "USER",
          followers: { none: { followerId: currentUser.id } },
          blockedByUsers: { none: { blockerId: currentUser.id } },
        },
        select: getUserDataSelect(currentUser.id, false),
        take: 12,
        orderBy: { createdAt: "desc" },
      });
      console.log("[RECOMMEND-FRIENDS] Fallback users:", fallback.length);
      return NextResponse.json({
        users: fallback,
        message: "Fallback recommendations",
      });
    }

    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: getUserDataSelect(currentUser.id, false),
    });

    const userMap = new Map(users.map((u) => [u.id, u]));
    const sortedUsers = recommendations
      .map((rec) => userMap.get(rec.id))
      .filter(Boolean);

    // const metadata = recommendations.map((rec) => ({
    //   userId: rec.id,
    //   mutualFriends: Number(rec.mutual_friends),
    //   sharedInterests: Number(rec.shared_interests_count),
    //   similarity: Number(rec.similarity.toFixed(3)),
    //   finalScore: Number(rec.final_score.toFixed(3)),
    // }));

    console.log("[RECOMMEND-FRIENDS] Returning", sortedUsers.length, "users");
    return NextResponse.json({
      users: sortedUsers,
      // metadata,
    });
  } catch (error) {
    console.error("[RECOMMEND-FRIENDS] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
