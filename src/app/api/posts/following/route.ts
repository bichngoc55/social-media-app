import { validateRequest } from "@/auth";
import prisma from "@/lib/prisma";
import { getPostDataInclude, PostsPage } from "@/lib/types";
import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const cursor = req.nextUrl.searchParams.get("cursor") || undefined;

    const pageSize = 10;

    const { user } = await validateRequest();

    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Kết hợp các queries để giảm số lần round-trip đến database
    const [followingUsers, blockedUsers] = await Promise.all([
      prisma.follow.findMany({
        where: { followerId: user.id },
        select: { followingId: true },
      }),
      prisma.userBlock.findMany({
        where: {
          OR: [
            { blockerId: user.id }, // User mình chặn
            { blockedId: user.id }, // User chặn mình
          ],
        },
        select: {
          blockerId: true,
          blockedId: true,
        },
      }),
    ]);

    const blockedUserIds = new Set([
      ...blockedUsers.map((b) => b.blockedId),
      ...blockedUsers.map((b) => b.blockerId),
    ]);

    // Loại bỏ chính mình khỏi danh sách
    blockedUserIds.delete(user.id);

    // Lấy posts từ user đang follow + chính mình, loại trừ user bị chặn
    const validFollowingIds = [
      ...followingUsers.map((f) => f.followingId),
      user.id, // Thêm chính mình
    ].filter((id) => !blockedUserIds.has(id));

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
      include: getPostDataInclude(user.id),
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
