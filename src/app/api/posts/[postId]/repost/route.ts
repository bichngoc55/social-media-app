import { validateRequest } from "@/auth";
import prisma from "@/lib/prisma";
import { NextRequest } from "next/server";

export async function POST(
  req: NextRequest,
  { params: { postId } }: { params: { postId: string } }
) {
  try {
    const { user } = await validateRequest();

    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Kiểm tra post có tồn tại không
    const originalPost = await prisma.post.findUnique({
      where: { id: postId },
      include: { user: true },
    });

    if (!originalPost) {
      return Response.json({ error: "Post not found" }, { status: 404 });
    }

    // Không cho phép repost chính bài đăng của mình
    if (originalPost.userId === user.id) {
      return Response.json({ error: "Cannot repost your own post" }, { status: 400 });
    }

    // Kiểm tra đã repost chưa
    const existingRepost = await prisma.post.findFirst({
      where: {
        userId: user.id,
        content: `Repost: ${originalPost.content}`,
        createdAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Trong 24h
        },
      },
    });

    if (existingRepost) {
      return Response.json({ error: "Already reposted" }, { status: 400 });
    }

    // Tạo repost
    const repost = await prisma.post.create({
      data: {
        content: `Repost: ${originalPost.content}`,
        userId: user.id,
        privacy: "PUBLIC", // Repost luôn là public
        // TODO: Thêm field originalPostId để track repost
      },
      include: {
        user: true,
        _count: {
          select: {
            likes: true,
            comments: true,
            bookmarks: true,
          },
        },
      },
    });

    return Response.json(repost);
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
