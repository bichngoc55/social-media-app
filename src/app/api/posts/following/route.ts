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

    // Lấy posts từ user đang follow + chính mình, loại trừ user bị chặn
    const validFollowingIds = [
      ...Array.from(followingUserIds),
      user.id, // Thêm chính mình
    ].filter((id) => !blockedUserIds.has(id));

    const posts = await prisma.post.findMany({
      where: {
        AND: [
          {
            userId: {
              in: validFollowingIds.length > 0 ? validFollowingIds : [user.id], // Fallback nếu không có following
            },
          },
          {
            OR: [
              // Public posts từ following users
              { privacy: "PUBLIC" },
              // Followers posts từ following users HOẶC chính mình
              {
                AND: [
                  { privacy: "FOLLOWERS" },
                  {
                    OR: [
                      { userId: { in: validFollowingIds } },
                      { userId: user.id }, // Chính mình
                    ],
                  },
                ],
              },
              // Draft posts chỉ của chính mình (nếu follow chính mình)
              {
                AND: [{ privacy: "DRAFT" }, { userId: user.id }],
              },
            ],
          },
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
