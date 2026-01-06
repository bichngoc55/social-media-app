import { requireAdmin } from "@/lib/admin";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    await requireAdmin();

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const search = searchParams.get("search") || "";
    const role = searchParams.get("role");

    const skip = (page - 1) * limit;

    const where: Prisma.UserWhereInput = {
      ...(search && {
        OR: [
          {
            username: { contains: search, mode: Prisma.QueryMode.insensitive },
          },
          {
            displayName: {
              contains: search,
              mode: Prisma.QueryMode.insensitive,
            },
          },
          { email: { contains: search, mode: Prisma.QueryMode.insensitive } },
        ],
      }),
      ...(role && { role: role as "USER" | "ADMIN" }),
    };

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          username: true,
          displayName: true,
          email: true,
          avatarUrl: true,
          role: true,
          emailVerified: true,
          createdAt: true,
          warningCount: true,
          bannedUntil: true,
          lastWarningAt: true,
          status: true,
          _count: {
            select: {
              posts: true,
              followers: true,
              following: true,
              reportsReceived: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.user.count({ where }),
    ]);

    // Calculate report statistics for each user
    const usersWithStats = await Promise.all(
      users.map(async (user) => {
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

        // Get total posts in last 30 days
        const totalPosts = await prisma.post.count({
          where: {
            userId: user.id,
            createdAt: { gte: thirtyDaysAgo },
          },
        });

        if (totalPosts === 0) {
          return {
            ...user,
            reportStats: {
              totalPosts: 0,
              reportedPosts: 0,
              aiDetectedPosts: 0,
              userReportedPosts: 0,
              bothDetectedPosts: 0,
              reportPercentage: 0,
            },
          };
        }

        // Get AI-detected posts (active violations only: QUEUED, IN_REVIEW)
        const aiDetectedCases = await prisma.moderationCase.findMany({
          where: {
            userId: user.id,
            source: "AI",
            status: { in: ["QUEUED", "IN_REVIEW"] },
            postId: { not: null },
            createdAt: { gte: thirtyDaysAgo },
          },
          select: { postId: true },
        });

        // Get user-reported posts
        const userReportedCases = await prisma.report.findMany({
          where: {
            reportedId: user.id,
            postId: { not: null },
            createdAt: { gte: thirtyDaysAgo },
          },
          select: { postId: true },
        });

        // Extract unique post IDs
        const aiPostIds = [
          ...new Set(
            aiDetectedCases
              .map((c) => c.postId)
              .filter((id): id is string => id !== null)
          ),
        ];

        const userPostIds = [
          ...new Set(
            userReportedCases
              .map((r) => r.postId)
              .filter((id): id is string => id !== null)
          ),
        ];

        // Find posts detected by both AI and users
        const bothDetectedPostIds = aiPostIds.filter((id) =>
          userPostIds.includes(id)
        );

        // Get unique reported posts (union of AI and user reports)
        const allReportedPostIds = [...new Set([...aiPostIds, ...userPostIds])];

        const reportedPostsCount = allReportedPostIds.length;
        const reportPercentage =
          totalPosts > 0 ? (reportedPostsCount / totalPosts) * 100 : 0;

        return {
          ...user,
          reportStats: {
            totalPosts,
            reportedPosts: reportedPostsCount,
            aiDetectedPosts: aiPostIds.length,
            userReportedPosts: userPostIds.length,
            bothDetectedPosts: bothDetectedPostIds.length,
            reportPercentage: Math.round(reportPercentage * 100) / 100,
          },
        };
      })
    );

    return NextResponse.json({
      users: usersWithStats,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching users:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      {
        status:
          error instanceof Error && error.message === "Unauthorized"
            ? 401
            : 500,
      }
    );
  }
}
