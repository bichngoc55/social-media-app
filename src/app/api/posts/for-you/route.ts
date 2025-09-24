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

    // Lấy danh sách user bị chặn
    const blockedUsers = await prisma.userBlock.findMany({
      where: {
        OR: [
          { blockerId: user.id }, // User mình chặn
          { blockedId: user.id },  // User chặn mình
        ],
      },
      select: {
        blockerId: true,
        blockedId: true,
      },
    });

    const blockedUserIds = new Set([
      ...blockedUsers.map(b => b.blockedId),
      ...blockedUsers.map(b => b.blockerId),
    ]);
    
    // Loại bỏ chính mình khỏi danh sách
    blockedUserIds.delete(user.id);

    const posts = await prisma.post.findMany({
      where: {
        userId: {
          notIn: Array.from(blockedUserIds),
        },
      },
      include: getPostDataInclude(user.id),
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
