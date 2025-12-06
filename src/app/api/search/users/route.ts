import { validateRequest } from "@/auth";
import prisma from "@/lib/prisma";
import { getUserDataSelect } from "@/lib/types";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const { user: loggedInUser } = await validateRequest();

    if (!loggedInUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const query = searchParams.get("q");
    const onlyFollowing = searchParams.get("onlyFollowing") === "true";

    if (!query || query.trim().length < 2) {
      return NextResponse.json({ users: [] });
    }
    console.log("search users", query, onlyFollowing);

    // Nếu chỉ tìm trong following users (dùng cho tagging)
    let followingIds: string[] = [];
    if (onlyFollowing) {
      const followingUsers = await prisma.follow.findMany({
        where: { followerId: loggedInUser.id },
        select: { followingId: true },
      });
      followingIds = followingUsers.map((f) => f.followingId);

      if (followingIds.length === 0) {
        return NextResponse.json({ users: [] });
      }
    }

    const users = await prisma.user.findMany({
      where: {
        AND: [
          {
            NOT: { id: loggedInUser.id }, // Exclude self
          },
          {
            OR: [
              { displayName: { contains: query, mode: "insensitive" } },
              { username: { contains: query, mode: "insensitive" } },
            ],
          },
          ...(onlyFollowing && followingIds.length > 0
            ? [{ id: { in: followingIds } }]
            : []),
        ],
      },
      select: getUserDataSelect(loggedInUser.id, true), // Lightweight mode cho search
      take: 10,
      orderBy: {
        displayName: "asc",
      },
    });

    return NextResponse.json({ users });
  } catch (error) {
    console.error("Error searching users:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
