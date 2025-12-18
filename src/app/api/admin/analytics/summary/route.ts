import { requireAdmin } from "@/lib/admin";
import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    await requireAdmin();

    // Get counts directly from database
    const [totalUsers, totalAdmins, totalPosts, totalReports] =
      await Promise.all([
        prisma.user.count(),
        prisma.user.count({ where: { role: "ADMIN" } }),
        prisma.post.count(),
        prisma.report.count(),
      ]);

    return NextResponse.json({
      totalUsers,
      totalAdmins,
      totalPosts,
      totalReports,
    });
  } catch (error) {
    console.error("Error fetching dashboard summary:", error);
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

