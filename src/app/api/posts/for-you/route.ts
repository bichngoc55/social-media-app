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

    // Tối ưu: Sử dụng cached data thay vì query mỗi lần
    const [blockedUserIds, followingUserIds] = await Promise.all([
      getCachedBlockedUsers(user.id),
      getCachedFollowingUsers(user.id),
    ]);

    const posts = await prisma.post.findMany({
      where: {
        AND: [
          {
            userId: {
              notIn:
                blockedUserIds.size > 0
                  ? Array.from(blockedUserIds)
                  : undefined,
            },
          },
          {
            OR: [
              // Public posts từ tất cả user (trừ blocked)
              { privacy: "PUBLIC" },
              // Followers posts từ user mình follow HOẶC chính mình
              {
                AND: [
                  { privacy: "FOLLOWERS" },
                  {
                    OR: [
                      { userId: { in: Array.from(followingUserIds) } },
                      { userId: user.id }, // Chính mình
                    ],
                  },
                ],
              },
              // Draft posts chỉ của chính mình
              {
                AND: [{ privacy: "DRAFT" }, { userId: user.id }],
              },
            ],
          },
        ],
      },
      include: getPostDataInclude(user.id, true), // Lightweight mode cho list
      orderBy: { createdAt: "desc" },
      take: pageSize + 1,
      cursor: cursor ? { id: cursor } : undefined,
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
