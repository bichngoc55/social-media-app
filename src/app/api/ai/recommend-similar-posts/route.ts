/**
 * API route để recommend similar posts sử dụng Hugging Face BGE-M3 embeddings
 * Next.js sẽ fetch data từ Prisma, format và gửi cho Python API
 */

import { validateRequest } from "@/auth";
import prisma from "@/lib/prisma";
import { getPostDataInclude } from "@/lib/types";
import { recommendSimilarPosts } from "@/lib/ai-api";
import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 30; // 30 seconds max duration for Vercel

export async function GET(req: NextRequest) {
  try {
    const { user } = await validateRequest();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if request was aborted
    if (req.signal?.aborted) {
      return NextResponse.json({ error: "Request aborted" }, { status: 499 });
    }

    const { searchParams } = new URL(req.url);
    const postId = searchParams.get("postId");

    if (!postId) {
      return NextResponse.json(
        { error: "postId is required" },
        { status: 400 }
      );
    }

    // Lấy post hiện tại
    const currentPost = await prisma.post.findUnique({
      where: { id: postId },
      select: {
        id: true,
        content: true,
        userId: true,
        comments: {
          select: { content: true },
          take: 50,
        },
      },
    });

    if (!currentPost) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    // Lấy candidate posts (public posts, không phải chính post đó)
    const candidatePosts = await prisma.post.findMany({
      where: {
        NOT: { id: postId },
        privacy: "PUBLIC",
      },
      select: {
        id: true,
        content: true,
        userId: true,
        comments: {
          select: { content: true },
          take: 50,
        },
      },
      take: 200, // Limit để tránh quá tải
    });

    // Format data để gửi cho Python API
    const postsData = [
      {
        id: currentPost.id,
        content: currentPost.content,
        userId: currentPost.userId,
        comment_contents: currentPost.comments.map((c) => c.content),
      },
      ...candidatePosts.map((p) => ({
        id: p.id,
        content: p.content,
        userId: p.userId,
        comment_contents: p.comments.map((c) => c.content),
      })),
    ];

    // Gọi Python AI API (Hugging Face BGE-M3)
    try {
      const recommendations = await recommendSimilarPosts(postId, postsData);

      // Lấy full post data cho recommended posts
      const recommendedPostIds = recommendations.map((r) => r.id);
      const recommendedPosts = await prisma.post.findMany({
        where: { id: { in: recommendedPostIds } },
        include: getPostDataInclude(user.id, true),
      });

      // Sắp xếp theo similarity score
      const postMap = new Map(recommendedPosts.map((p) => [p.id, p]));
      const sortedPosts = recommendations
        .map((rec) => ({
          post: postMap.get(rec.id),
          similarity: rec.similarity,
        }))
        .filter((item) => item.post)
        .map((item) => item.post!);

      return NextResponse.json({
        posts: sortedPosts,
        similarities: Object.fromEntries(
          recommendations.map((r) => [r.id, r.similarity])
        ),
      });
    } catch (pythonError) {
      console.error("Python AI API error, using fallback:", pythonError);
      // Fallback: simple query
      const fallbackPosts = await prisma.post.findMany({
        where: {
          NOT: { id: postId },
          privacy: "PUBLIC",
        },
        include: getPostDataInclude(user.id, true),
        take: 5,
        orderBy: { createdAt: "desc" },
      });

      return NextResponse.json({
        posts: fallbackPosts,
        similarities: {},
        metadata: { message: "Python AI API unavailable, using fallback." },
      });
    }
  } catch (error) {
    console.error("Error in AI recommend-similar-posts route:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
