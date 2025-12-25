import { requireAdmin } from "@/lib/admin";
import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const admin = await requireAdmin();

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") || undefined;
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "20");
    const skip = (page - 1) * pageSize;

    // Build where clause
    const where: any = {};
    if (
      status &&
      ["PENDING", "UNDER_REVIEW", "APPROVED", "REJECTED"].includes(status)
    ) {
      where.status = status;
    }

    // Get appeals with relations
    const [appeals, total] = await Promise.all([
      prisma.appealUserReport.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              username: true,
              displayName: true,
              avatarUrl: true,
            },
          },
          post: {
            select: {
              id: true,
              content: true,
              harmful: true,
              harmfulTypes: true,
              createdAt: true,
              attachments: {
                select: {
                  id: true,
                  url: true,
                  type: true,
                },
              },
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
        skip,
        take: pageSize,
      }),
      prisma.appealUserReport.count({ where }),
    ]);

    return NextResponse.json({
      appeals,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    console.error("Error fetching appeals:", error);
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
