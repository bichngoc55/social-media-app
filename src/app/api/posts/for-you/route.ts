import { validateRequest } from "@/auth";
import { PostsPage } from "@/lib/types";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 30;

export async function GET(req: NextRequest) {
  try {
    console.log("[FOR-YOU] Request received");
    const cursor = req.nextUrl.searchParams.get("cursor") || undefined;
    const pageSize = 10;

    const { user } = await validateRequest();

    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.log("[FOR-YOU] User:", user.id);

    const excludePostIds: string[] = cursor
      ? cursor.split(",").filter(Boolean)
      : [];

    const baseUrl =
      process.env.NEXT_PUBLIC_BASE_URL ||
      `http://localhost:${process.env.PORT || 3000}`;
    const response = (await fetch(`${baseUrl}/api/ai/recommend-posts`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Cookie: req.headers.get("cookie") || "",
      },
    }).then((res) => res.json())) as { posts: any[]; metadata?: any };
    console.log(
      "[FOR-YOU] Response received:",
      response.posts?.length,
      "posts"
    );

    if (!response.posts || response.posts.length === 0) {
      console.log("[FOR-YOU] No posts in response");
      return Response.json({
        posts: [],
        nextCursor: null,
      });
    }

    const filteredPosts = response.posts
      .filter((post) => !excludePostIds.includes(post.id) && post.user)
      .slice(0, pageSize);

    const allExcludedIds = [
      ...excludePostIds,
      ...filteredPosts.map((p) => p.id),
    ];

    const nextCursor =
      response.posts.length > pageSize ? allExcludedIds.join(",") : null;

    const data: PostsPage = {
      posts: filteredPosts,
      nextCursor: filteredPosts.length > 0 ? nextCursor : null,
    };

    console.log("[FOR-YOU] Returning", data.posts.length, "posts");
    return Response.json(data);
  } catch (error) {
    console.error("[FOR-YOU] Error:", error);
    return Response.json(
      {
        posts: [],
        nextCursor: null,
      },
      { status: 200 }
    );
  }
}
