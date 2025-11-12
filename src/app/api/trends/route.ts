import { validateRequest } from "@/auth";
import prisma from "@/lib/prisma";
import { getUserDataSelect } from "@/lib/types";
import { formatNumber } from "@/lib/utils";
import { unstable_cache } from "next/cache";
import { NextResponse } from "next/server";

const getTrendingTopics = unstable_cache(
  async () => {
    const result = await prisma.$queryRaw<
      { hashtag: string; count: bigint }[]
    >` 
            SELECT LOWER(unnest(regexp_matches(content, '#[[:alnum:]_]+', 'g'))) AS hashtag, COUNT(*) AS count
            FROM posts
            GROUP BY (hashtag)
            ORDER BY count DESC, hashtag ASC
            LIMIT 5
        `;

    return result.map((row) => ({
      hashtag: row.hashtag,
      count: Number(row.count),
    }));
  },
  ["trending_topics"],
  {
    revalidate: 3 * 60 * 60,
  }
);

export async function GET() {
  try {
    const { user } = await validateRequest();

    if (!user) {
      return NextResponse.json({ usersToFollow: [], trendingTopics: [] });
    }

    const [usersToFollow, trendingTopics] = await Promise.all([
      prisma.user.findMany({
        where: {
          NOT: {
            id: user.id,
          },
          followers: {
            none: {
              followerId: user.id,
            },
          },
        },
        select: getUserDataSelect(user.id, true), // Lightweight mode
        take: 5,
        orderBy: {
          createdAt: "desc", // Lấy user mới nhất
        },
      }),
      getTrendingTopics(),
    ]);

    return NextResponse.json({
      usersToFollow,
      trendingTopics,
    });
  } catch (error) {
    console.error("Error fetching trends:", error);
    return NextResponse.json(
      { error: "Failed to fetch trends" },
      { status: 500 }
    );
  }
}
