import { validateRequest } from "@/auth";
import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const { user } = await validateRequest();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const currentUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        generalEmotion: true,
        emotionScore: true,
      },
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

    const emotionHistory = recentPosts.reduce(
      (acc, post) => {
        const dateKey = post.createdAt.toISOString().split("T")[0];
        if (!acc[dateKey]) {
          acc[dateKey] = {
            date: dateKey,
            scores: [],
            emotions: [],
          };
        }
        acc[dateKey].scores.push(post.emotionScore || 0);
        acc[dateKey].emotions.push(post.emotions);
        return acc;
      },
      {} as Record<string, { date: string; scores: number[]; emotions: any[] }>
    );

    const chartData = Object.values(emotionHistory)
      .map((day) => ({
        date: day.date,
        avgScore: day.scores.reduce((a, b) => a + b, 0) / day.scores.length,
        emotion: day.emotions[0],
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
      currentEmotion: currentUser?.generalEmotion,
      currentScore: currentUser?.emotionScore,
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
