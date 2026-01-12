import { validateRequest } from "@/auth";
import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const { user } = await validateRequest();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user's current general emotion (updated from latest post)
    const currentUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        generalEmotion: true,
      },
    });

    // Get latest post's AI-analyzed emotion score
    const latestPost = await prisma.post.findFirst({
      where: {
        userId: user.id,
        emotionScore: { not: null },
      },
      select: {
        emotionScore: true,
      },
      orderBy: { createdAt: "desc" },
    });

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentPosts = await prisma.post.findMany({
      where: {
        userId: user.id,
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

    // Get the newest post per day (not daily average)
    const emotionHistory = recentPosts.reduce(
      (acc, post) => {
        const dateKey = post.createdAt.toISOString().split("T")[0];
        if (!acc[dateKey] || post.createdAt > acc[dateKey].timestamp) {
          acc[dateKey] = {
            date: dateKey,
            score: post.emotionScore || 0,
            emotion: post.emotions,
            timestamp: post.createdAt,
          };
        }
        return acc;
      },
      {} as Record<
        string,
        { date: string; score: number; emotion: any; timestamp: Date }
      >
    );

    const chartData = Object.values(emotionHistory)
      .map((day) => ({
        date: day.date,
        avgScore: day.score,
        emotion: day.emotion,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const harmfulPosts = recentPosts.filter((p) => p.harmful);
    const lowScorePosts = recentPosts.filter(
      (p) => (p.emotionScore || 0) < 0.3
    );

    const alerts = [
      ...harmfulPosts.map((p) => ({
        type: "harmful" as const,
        date: p.createdAt,
        harmfulTypes: p.harmfulTypes,
        message: `Harmful content detected: ${p.harmfulTypes.join(", ")}`,
        postId: p.id,
      })),
      ...lowScorePosts.map((p) => ({
        type: "low-emotion" as const,
        date: p.createdAt,
        message: `Low emotion score detected (${(p.emotionScore! * 100).toFixed(0)}%)`,
        postId: p.id,
      })),
    ].sort((a, b) => b.date.getTime() - a.date.getTime());

    const userWithLocation = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        countryCode: true,
        provinceCode: true,
      },
    });

    // Get the latest post with wisdom message
    const latestPostWithWisdom = await prisma.post.findFirst({
      where: {
        userId: user.id,
        wisdomOrAdviceMessage: { not: null },
      },
      select: {
        wisdomOrAdviceMessage: true,
      },
      orderBy: { createdAt: "desc" },
    });
    // console.log("Latest post with wisdom:", latestPostWithWisdom);
    return NextResponse.json({
      currentEmotion: currentUser?.generalEmotion || "NEUTRAL",
      currentScore: latestPost?.emotionScore || 0.5,
      chartData,
      alerts,
      recentPostsCount: recentPosts.length,
      countryCode: userWithLocation?.countryCode,
      provinceCode: userWithLocation?.provinceCode,
      wisdomMessage: latestPostWithWisdom?.wisdomOrAdviceMessage || null,
    });
  } catch (error) {
    console.error("Error fetching mental health data:", error);
    return NextResponse.json(
      { error: "Failed to fetch mental health data" },
      { status: 500 }
    );
  }
}
