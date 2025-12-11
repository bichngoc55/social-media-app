import { validateRequest } from "@/auth";
import prisma from "@/lib/prisma";
import { getUserDataSelect } from "@/lib/types";
import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

/**
 * Search users that have mutual follow with logged in user
 */
export async function GET(req: NextRequest) {
  try {
    const { user: loggedInUser } = await validateRequest();

    if (!loggedInUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const query = req.nextUrl.searchParams.get("q") || "";

    // Get users that logged in user follows
    const followingUsers = await prisma.follow.findMany({
      where: { followerId: loggedInUser.id },
      select: { followingId: true },
    });

    const followingIds = followingUsers.map((f) => f.followingId);

    if (followingIds.length === 0) {
      return NextResponse.json({ users: [] });
    }

    // Get users that follow logged in user AND logged in user also follows them (mutual follow)
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

    if (mutualFollowUserIds.length === 0) {
      return NextResponse.json({ users: [] });
    }

    // Search users from database
    const users = await prisma.user.findMany({
      where: {
        AND: [
          { id: { in: mutualFollowUserIds } },
          ...(query.trim().length >= 2
            ? [
                {
                  OR: [
                    {
                      displayName: {
                        contains: query,
                        mode: Prisma.QueryMode.insensitive,
                      },
                    },
                    {
                      username: {
                        contains: query,
                        mode: Prisma.QueryMode.insensitive,
                      },
                    },
                  ],
                },
              ]
            : []),
        ],
      },
      select: getUserDataSelect(loggedInUser.id, true),
      take: 15,
      orderBy: {
        displayName: "asc",
      },
    });

    return NextResponse.json({ users });
  } catch (error) {
    console.error("Error searching mutual follow users:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
