import { validateRequest } from "@/auth";
import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  try {
    const { user: loggedInUser } = await validateRequest();
    if (!loggedInUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { username } = await params;
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");

    // Find user by username
    const user = await prisma.user.findFirst({
      where: {
        username: {
          equals: username,
          mode: "insensitive",
        },
      },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const skip = (page - 1) * limit;

    // Get following (users that this user follows)
    const [following, total] = await Promise.all([
      prisma.follow.findMany({
        where: { followerId: user.id },
        include: {
          following: {
            select: {
              id: true,
              username: true,
              displayName: true,
              avatarUrl: true,
              bio: true,
              _count: {
                select: {
                  posts: true,
                  followers: true,
                  following: true,
                },
              },
            },
          },
        },
        // Note: Follow model doesn't have createdAt, so we can't order by it
        // Order by followerId instead (or remove orderBy)
        skip,
        take: limit,
      }),
      prisma.follow.count({
        where: { followerId: user.id },
      }),
    ]);

    // Check if logged in user follows each following user
    const followingWithFollowStatus = await Promise.all(
      following.map(async (follow) => {
        if (!follow.following) {
          return null;
        }

        const isFollowedByLoggedInUser = await prisma.follow.findUnique({
          where: {
            followerId_followingId: {
              followerId: loggedInUser.id,
              followingId: follow.following.id,
            },
          },
        });

        return {
          ...follow.following,
          isFollowedByUser: !!isFollowedByLoggedInUser,
        };
      })
    );

    // Filter out null values
    const validFollowing = followingWithFollowStatus.filter(
      (user) => user !== null
    ) as (typeof followingWithFollowStatus)[0][];

    return NextResponse.json({
      users: validFollowing,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching following:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}
