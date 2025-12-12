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

    const currentUser = await prisma.user.findUnique({
      where: { id: authUser.id },
    });

    if (!currentUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Query tasteEmbedding as raw string and parse it
    const userWithEmbedding = await prisma.$queryRaw<
      Array<{ tasteEmbedding: string | null }>
    >`
      SELECT "tasteEmbedding"::text as "tasteEmbedding"
      FROM users
      WHERE id = ${authUser.id}
    `;

    let tasteEmbedding: number[] | null = null;
    if (userWithEmbedding[0]?.tasteEmbedding) {
      const vectorStr = userWithEmbedding[0].tasteEmbedding;
      tasteEmbedding = vectorStr
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

    const recommendations = await prisma.$queryRaw<
      Array<{
        id: string;
        username: string;
        displayName: string;
        avatarUrl: string | null;
        generalEmotion: string | null;
        mutual_friends: bigint;
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
        (
          SELECT COUNT(*)
          FROM follows f1
          JOIN follows f2 ON f1."followingId" = f2."followingId"
          WHERE f1."followerId" = ${currentUser.id}
            AND f2."followerId" = u.id
        ) as mutual_friends,
        -- Exact Cosine Similarity (1 - distance)
        (1 - (u."tasteEmbedding" <=> ${userTasteStr}::vector)) as similarity,
        (
          -- 1. Behavioral Match (45%)
          (1 - (u."tasteEmbedding" <=> ${userTasteStr}::vector)) * 0.45 +
          
          -- 2. Social Proof (25%) - Capped at 15 mutual friends
          -- Formula: LEAST(count, 15) / 15.0 * 0.25
          (LEAST((
            SELECT COUNT(*)
            FROM follows f1
            JOIN follows f2 ON f1."followingId" = f2."followingId"
            WHERE f1."followerId" = ${currentUser.id}
              AND f2."followerId" = u.id
          ), 15)::float / 15.0) * 0.25 +

          -- 3. Emotion Compatibility (15%)
          (CASE 
            WHEN u."generalEmotion"::text = ${userEmotion} THEN 1.0
            WHEN (u."generalEmotion"::text = 'POSITIVE' AND ${userEmotion} = 'NEUTRAL') 
              OR (u."generalEmotion"::text = 'NEUTRAL' AND ${userEmotion} = 'POSITIVE') THEN 0.6
            WHEN u."generalEmotion" IS NULL THEN 0.2
            ELSE 0.0
          END) * 0.15 +

          -- 4. Location (15%)
          (CASE WHEN u."provinceCode" = ${userProvince} THEN 1.0 ELSE 0.0 END) * 0.15 
        ) as final_score
      FROM users u
      WHERE u."tasteEmbedding" IS NOT NULL
        AND u.id != ${currentUser.id}
        -- Filter out already followed users
        AND u.id NOT IN (SELECT "followingId" FROM follows WHERE "followerId" = ${currentUser.id})
        -- Filter out blocked interactions
        AND u.id NOT IN (SELECT "blockedId" FROM user_blocks WHERE "blockerId" = ${currentUser.id})
        AND u.id NOT IN (SELECT "blockerId" FROM user_blocks WHERE "blockedId" = ${currentUser.id})
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

    const metadata = recommendations.map((rec) => ({
      userId: rec.id,
      mutualFriends: Number(rec.mutual_friends),
      similarity: Number(rec.similarity.toFixed(3)),
      finalScore: Number(rec.final_score.toFixed(3)),
    }));

    console.log("[RECOMMEND-FRIENDS] Returning", sortedUsers.length, "users");
    return NextResponse.json({
      users: sortedUsers,
      metadata,
    });
  } catch (error) {
    console.error("[RECOMMEND-FRIENDS] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
