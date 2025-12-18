import { requireAdmin } from "@/lib/admin";
import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    await requireAdmin();

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");

    const skip = (page - 1) * limit;

    // Get trending hashtags from posts with pagination
    const [hashtagStats, total] = await Promise.all([
      prisma.$queryRaw<
        Array<{ hashtag: string; count: bigint }>
      >`
        SELECT 
          LOWER(TRIM(tag)) AS hashtag,
          COUNT(*)::bigint AS count
        FROM "posts",
        LATERAL unnest(hashtags) AS tag
        WHERE array_length(hashtags, 1) > 0
        GROUP BY LOWER(TRIM(tag))
        ORDER BY count DESC
        LIMIT ${limit}
        OFFSET ${skip}
      `,
      prisma.$queryRaw<Array<{ total: bigint }>>`
        SELECT COUNT(DISTINCT LOWER(TRIM(tag)))::bigint AS total
        FROM "posts",
        LATERAL unnest(hashtags) AS tag
        WHERE array_length(hashtags, 1) > 0
      `,
    ]);

    // Transform to match component format
    const topics = hashtagStats.map((stat) => ({
      tag: stat.hashtag.startsWith("#")
        ? stat.hashtag
        : `#${stat.hashtag}`,
      count: Number(stat.count),
    }));

    const totalCount = Number(total[0]?.total || 0);

    return NextResponse.json({
      topics,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching trending topics:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Internal server error",
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

