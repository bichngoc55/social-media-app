import { validateRequest } from "@/auth";
import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

/**
 * Get list of users that have mutual follow with logged in user
 */
export async function GET(req: NextRequest) {
  try {
    const { user: loggedInUser } = await validateRequest();

    if (!loggedInUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get users that logged in user follows
    const followingUsers = await prisma.follow.findMany({
      where: { followerId: loggedInUser.id },
      select: { followingId: true },
    });

    const followingIds = followingUsers.map((f) => f.followingId);

    if (followingIds.length === 0) {
      return NextResponse.json({ mutualFollowUserIds: [] });
    }

    // Get users that follow logged in user AND logged in user also follows them
    const mutualFollows = await prisma.follow.findMany({
      where: {
        AND: [
          { followingId: loggedInUser.id }, // They follow logged in user
          { followerId: { in: followingIds } }, // Logged in user also follows them
        ],
      },
      select: { followerId: true },
    });

    const mutualFollowUserIds = mutualFollows.map((f) => f.followerId);

    return NextResponse.json({ mutualFollowUserIds });
  } catch (error) {
    console.error("Error getting mutual follows:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
