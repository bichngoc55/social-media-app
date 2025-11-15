import { validateRequest } from "@/auth";
import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

/**
 * Check if two users follow each other (mutual follow)
 */
export async function GET(
  req: NextRequest,
  { params: { userId } }: { params: { userId: string } }
) {
  try {
    const { user: loggedInUser } = await validateRequest();

    if (!loggedInUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if logged in user follows the target user
    const loggedInFollowsTarget = await prisma.follow.findUnique({
      where: {
        followerId_followingId: {
          followerId: loggedInUser.id,
          followingId: userId,
        },
      },
    });

    // Check if target user follows logged in user
    const targetFollowsLoggedIn = await prisma.follow.findUnique({
      where: {
        followerId_followingId: {
          followerId: userId,
          followingId: loggedInUser.id,
        },
      },
    });

    const isMutualFollow = !!loggedInFollowsTarget && !!targetFollowsLoggedIn;

    return NextResponse.json({
      isMutualFollow,
      loggedInFollowsTarget: !!loggedInFollowsTarget,
      targetFollowsLoggedIn: !!targetFollowsLoggedIn,
    });
  } catch (error) {
    console.error("Error checking mutual follow:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
