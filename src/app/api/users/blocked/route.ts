import { validateRequest } from "@/auth";
import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const { user: loggedInUser } = await validateRequest();

    if (!loggedInUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const page = parseInt(req.nextUrl.searchParams.get("page") || "1");
    const limit = parseInt(req.nextUrl.searchParams.get("limit") || "20");
    const offset = (page - 1) * limit;

    // Lấy danh sách user đã chặn
    const blockedUsers = await prisma.userBlock.findMany({
      where: {
        blockerId: loggedInUser.id,
      },
      include: {
        blocked: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
            bio: true,
            createdAt: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      skip: offset,
      take: limit,
    });

    // Đếm tổng số
    const total = await prisma.userBlock.count({
      where: {
        blockerId: loggedInUser.id,
      },
    });

    return NextResponse.json({
      blockedUsers: blockedUsers.map(block => ({
        id: block.blocked.id,
        username: block.blocked.username,
        displayName: block.blocked.displayName,
        avatarUrl: block.blocked.avatarUrl,
        bio: block.blocked.bio,
        blockedAt: block.createdAt,
        blockReason: block.reason,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });

  } catch (error) {
    console.error("Error fetching blocked users:", error);
    return NextResponse.json({ 
      error: "Internal server error" 
    }, { status: 500 });
  }
}
