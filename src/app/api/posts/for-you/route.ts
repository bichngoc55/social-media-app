import { validateRequest } from "@/auth";
import { PostsPage } from "@/lib/types";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  try {
    const { user } = await validateRequest();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const cursor = body.cursor || "";
    const excludePostIds = cursor.split(",").filter(Boolean);
    const pageSize = 10;

    const baseUrl =
      process.env.NEXT_PUBLIC_BASE_URL ||
      `http://localhost:${process.env.PORT || 3000}`;

    // Pass 'excludeIds' via POST body to avoid long URL issues
    const response = await fetch(`${baseUrl}/api/ai/recommend-posts`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: req.headers.get("cookie") || "",
      },
      body: JSON.stringify({ excludeIds: excludePostIds }),
      next: { revalidate: 60 }, // Cache results for 60 seconds
    }).then((res) => res.json());

    if (!response.posts || response.posts.length === 0) {
      return Response.json({ posts: [], nextCursor: null });
    }

    const filteredPosts = response.posts
      .filter((post: any) => !excludePostIds.includes(post.id) && post.user)
      .slice(0, pageSize);

    const newPostIds = filteredPosts.map((p: any) => p.id);
    const allSeenIds = [...excludePostIds, ...newPostIds];

    // Keep only the last 100 IDs to keep the "cursor" body size reasonable
    const trimmedSeenIds = allSeenIds.slice(-100);
    const nextCursor =
      trimmedSeenIds.length > 0 ? trimmedSeenIds.join(",") : null;

    return Response.json({
      posts: filteredPosts,
      nextCursor: nextCursor,
    });
  } catch (error) {
    console.error("[FOR-YOU] Error:", error);
    return Response.json({ posts: [], nextCursor: null }, { status: 500 });
  }
}
