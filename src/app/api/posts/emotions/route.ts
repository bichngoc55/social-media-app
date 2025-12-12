import { validateRequest } from "@/auth";
import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const { user } = await validateRequest();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get emotion distribution
    const emotionStats = await prisma.$queryRaw<
      Array<{ emotion: string; count: bigint }>
    >`
      SELECT emotions as emotion, COUNT(*) as count
      FROM "posts"
      WHERE emotions IS NOT NULL
      GROUP BY emotions
      ORDER BY count DESC
    `;

    // Get average emotion scores
    const avgScores = await prisma.$queryRaw<
      Array<{ emotion: string; avg_score: number }>
    >`
      SELECT emotions as emotion, AVG("emotionScore") as avg_score
      FROM "posts"
      WHERE emotions IS NOT NULL AND "emotionScore" IS NOT NULL
      GROUP BY emotions
    `;

    // Get trending emotions (last 7 days)
    const trendingEmotions = await prisma.$queryRaw<
      Array<{ emotion: string; count: bigint }>
    >`
      SELECT emotions as emotion, COUNT(*) as count
      FROM "posts"
      WHERE emotions IS NOT NULL 
        AND "createdAt" > NOW() - INTERVAL '7 days'
      GROUP BY emotions
      ORDER BY count DESC
    `;

    return NextResponse.json({
      distribution: emotionStats.map((stat) => ({
        emotion: stat.emotion,
        count: Number(stat.count),
      })),
      averageScores: avgScores.map((stat) => ({
        emotion: stat.emotion,
        avgScore: stat.avg_score,
      })),
      trending: trendingEmotions.map((stat) => ({
        emotion: stat.emotion,
        count: Number(stat.count),
      })),
    });
  } catch (error) {
    console.error("Emotion stats error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
