import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { sendPermanentBanEmail } from "@/lib/email";

export const maxDuration = 300;

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log("🔍 Starting automated violation rate check...");

    // Get admin user for issuing warnings
    const adminUser = await prisma.user.findFirst({
      where: { role: "ADMIN" },
      select: { id: true },
    });

    if (!adminUser) {
      return NextResponse.json(
        { error: "No admin user found" },
        { status: 500 }
      );
    }

    const users = await prisma.user.findMany({
      where: {
        warningCount: { lt: 3 }, // Check all users with less than 3 warnings (including 0)
        status: true,
        OR: [
          { lastWarningAt: null }, // Include users who have never been warned
          {
            lastWarningAt: { lte: new Date(Date.now() - 72 * 60 * 60 * 1000) },
          }, // Or last warning was 72+ hours ago
        ],
      },
      select: {
        id: true,
        username: true,
        displayName: true,
        email: true,
        warningCount: true,
      },
    });

    console.log(`Found ${users.length} users to check`);
    const results = [];

    for (const user of users) {
      // Calculate violation rate the same way as admin UI
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      const totalPosts = await prisma.post.count({
        where: {
          userId: user.id,
          createdAt: { gte: thirtyDaysAgo },
        },
      });

      if (totalPosts === 0) continue;

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

      // Get unique reported posts (union of AI and user reports)
      const allReportedPostIds = [...new Set([...aiPostIds, ...userPostIds])];
      const violationRate = (allReportedPostIds.length / totalPosts) * 100;

      if (violationRate >= 70) {
        const newWarningCount = (user.warningCount || 0) + 1;
        const shouldPermanentBan = newWarningCount >= 3;

        await prisma.userWarning.create({
          data: {
            userId: user.id,
            issuedBy: adminUser.id,
            message: `Automated warning ${newWarningCount}/3: Violation rate ${violationRate.toFixed(2)}%`,
            deadline: new Date(Date.now() + 72 * 60 * 60 * 1000),
          },
        });

        await prisma.user.update({
          where: { id: user.id },
          data: {
            warningCount: newWarningCount,
            lastWarningAt: new Date(),
            ...(shouldPermanentBan && { status: false }),
          } as any,
        });

        await prisma.notification.create({
          data: {
            recipientId: user.id,
            issuerId: adminUser.id,
            type: shouldPermanentBan
              ? ("BAN_NOTICE" as any)
              : ("WARNING" as any),
          } as any,
        });

        if (shouldPermanentBan && user.email) {
          await sendPermanentBanEmail(
            user.email,
            user.displayName,
            newWarningCount
          );
        }

        results.push({
          userId: user.id,
          warningCount: newWarningCount,
          action: shouldPermanentBan ? "BANNED" : "WARNED",
        });
      }
    }

    return NextResponse.json({ success: true, results });
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
