import { validateRequest } from "@/auth";
import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { getPostDataInclude } from "@/lib/types";

export async function GET(req: NextRequest) {
  try {
    const { user } = await validateRequest();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const targetUserId = searchParams.get("userId");
    const cursor = searchParams.get("cursor") || undefined;
    const pageSize = 10;

    // Get all posts with harmful = true for the target user (or current user if no userId provided)
    const userIdToQuery = targetUserId || user.id;

    // Get posts with harmful = true (bị AI cảnh báo)
    const posts = await prisma.post.findMany({
      where: {
        userId: userIdToQuery,
        harmful: true, // Chỉ lấy các bài viết bị AI cảnh báo
      },
      include: getPostDataInclude(user.id, true), // Lightweight post data
      orderBy: { createdAt: "desc" },
      take: pageSize + 1,
      cursor: cursor ? { id: cursor } : undefined,
    });

    const nextCursor = posts.length > pageSize ? posts[pageSize].id : null;

    const data = {
      posts: posts.slice(0, pageSize),
      nextCursor,
    };

    return NextResponse.json({ posts });
  } catch (error) {
    console.error("Error fetching warned posts:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
