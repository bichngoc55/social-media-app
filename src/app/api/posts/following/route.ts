import { validateRequest } from "@/auth";
import prisma from "@/lib/prisma";
import { getPostDataInclude, PostsPage } from "@/lib/types";
import { getCachedBlockedUsers, getCachedFollowingUsers } from "@/lib/cache";
import { NextRequest } from "next/server";

// Tối ưu: Cache route config
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: NextRequest) {
  try {
    const cursor = req.nextUrl.searchParams.get("cursor") || undefined;

    const pageSize = 10;

    const { user } = await validateRequest();

    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Tối ưu: Sử dụng cached data
    const [blockedUserIds, followingUserIds] = await Promise.all([
      getCachedBlockedUsers(user.id),
      getCachedFollowingUsers(user.id),
    ]);

    // Lấy posts từ user đang follow ONLY, loại trừ user bị chặn và chính mình
    const validFollowingIds = Array.from(followingUserIds).filter(
      (id) => !blockedUserIds.has(id)
    );

    // If not following anyone, return empty
    if (validFollowingIds.length === 0) {
      return Response.json({
        posts: [],
        nextCursor: null,
      });
    }

    // Get reported post IDs
    const reportedPosts = await prisma.report.findMany({
      where: {
        reporterId: user.id,
        postId: { not: null },
      },
      select: { postId: true },
    });
    const reportedPostIds = reportedPosts
      .map((r) => r.postId)
      .filter((id): id is string => id !== null);

    const posts = await prisma.post.findMany({
      where: {
        AND: [
          {
            userId: {
              in: validFollowingIds,
            },
          },
          {
            OR: [
              // Public posts từ following users
              { privacy: "PUBLIC" },
              // Followers posts từ following users (if current user follows them back)
              {
                AND: [
                  { privacy: "FOLLOWERS" },
                  { userId: { in: validFollowingIds } },
                ],
              },
            ],
          },
          // Exclude reported posts
          ...(reportedPostIds.length > 0
            ? [{ id: { notIn: reportedPostIds } }]
            : []),
        ],
      },
      orderBy: { createdAt: "desc" },
      take: pageSize + 1,
      cursor: cursor ? { id: cursor } : undefined,
      include: getPostDataInclude(user.id, true), // Lightweight mode cho list
    });

    const nextCursor = posts.length > pageSize ? posts[pageSize].id : null;

    const data: PostsPage = {
      posts: posts.slice(0, pageSize),
      nextCursor,
    };

    return Response.json(data);
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
