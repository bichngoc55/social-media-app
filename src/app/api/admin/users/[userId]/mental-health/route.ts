import { requireAdmin } from "@/lib/admin";
import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params;
    await requireAdmin();

    const currentUser = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        generalEmotion: true,
        emotionScore: true,
      },
    });

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentPosts = await prisma.post.findMany({
      where: {
        userId: userId,
        createdAt: { gte: thirtyDaysAgo },
        emotions: { not: null },
        emotionScore: { not: null },
      },
      select: {
        id: true,
        createdAt: true,
        emotions: true,
        emotionScore: true,
        primaryEmotion: true,
        topics: true,
        harmful: true,
        harmfulTypes: true,
      },
      orderBy: { createdAt: "desc" },
    });

    const emotionHistory = recentPosts.reduce(
      (acc, post) => {
        if (
          !post.emotionScore ||
          post.emotionScore === null ||
          !post.emotions
        ) {
          return acc;
        }
        try {
          const dateKey = post.createdAt.toISOString().split("T")[0];
          if (!acc[dateKey]) {
            acc[dateKey] = {
              date: dateKey,
              scores: [],
              emotions: [],
            };
          }
          acc[dateKey].scores.push(post.emotionScore);
          acc[dateKey].emotions.push(post.emotions);
        } catch (err) {
          console.error("Error processing post date:", err);
        }
        return acc;
      },
      {} as Record<string, { date: string; scores: number[]; emotions: any[] }>
    );

    const chartData = Object.values(emotionHistory)
      .map((day) => {
        if (day.scores.length === 0) {
          return {
            date: day.date,
            avgScore: 0,
            emotion: day.emotions[0] || null,
          };
        }
        return {
          date: day.date,
          avgScore: day.scores.reduce((a, b) => a + b, 0) / day.scores.length,
          emotion: day.emotions[0] || null,
        };
      })
      .sort((a, b) => a.date.localeCompare(b.date));

    const harmfulPosts = recentPosts.filter(
      (p) =>
        p.harmful === true &&
        p.harmfulTypes &&
        Array.isArray(p.harmfulTypes) &&
        p.harmfulTypes.length > 0
    );
    const lowScorePosts = recentPosts.filter(
      (p) =>
        p.emotionScore !== null &&
        typeof p.emotionScore === "number" &&
        p.emotionScore < 0.3
    );

    const alerts = [
      ...harmfulPosts.map((p) => {
        const harmfulTypesArray = Array.isArray(p.harmfulTypes)
          ? p.harmfulTypes
          : [];
        return {
          type: "harmful" as const,
          date:
            p.createdAt instanceof Date
              ? p.createdAt.toISOString()
              : p.createdAt,
          message: `Harmful content detected: ${harmfulTypesArray.join(", ")}`,
          postId: p.id,
        };
      }),
      ...lowScorePosts.map((p) => {
        const score =
          p.emotionScore !== null && typeof p.emotionScore === "number"
            ? p.emotionScore
            : 0;
        return {
          type: "low-emotion" as const,
          date:
            p.createdAt instanceof Date
              ? p.createdAt.toISOString()
              : p.createdAt,
          message: `Low emotion score detected (${(score * 100).toFixed(0)}%)`,
          postId: p.id,
        };
      }),
    ].sort((a, b) => {
      const dateA = typeof a.date === "string" ? new Date(a.date).getTime() : 0;
      const dateB = typeof b.date === "string" ? new Date(b.date).getTime() : 0;
      return dateB - dateA;
    });

    return NextResponse.json({
      currentEmotion: currentUser?.generalEmotion,
      currentScore: currentUser?.emotionScore,
      chartData,
      alerts,
      recentPostsCount: recentPosts.length,
    });
  } catch (error) {
    console.error("Error fetching user mental health data:", error);
    console.error(
      "Error stack:",
      error instanceof Error ? error.stack : "No stack"
    );
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
        details:
          process.env.NODE_ENV === "development" && error instanceof Error
            ? error.stack
            : undefined,
      },
      {
        status:
          error instanceof Error && error.message === "Unauthorized"
            ? 401
            : error instanceof Error && error.message.includes("Forbidden")
              ? 403
              : 500,
      }
    );
  }
}
