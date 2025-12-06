import { validateRequest } from "@/auth";
import prisma from "@/lib/prisma";
import { getPostDataInclude, getUserDataSelect, PostsPage } from "@/lib/types";
import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const q = req.nextUrl.searchParams.get("q") || "";
    const cursor = req.nextUrl.searchParams.get("cursor") || undefined;
    const emotion = req.nextUrl.searchParams.get("emotion") as
      | "POSITIVE"
      | "NEGATIVE"
      | "NEUTRAL"
      | null;
    const type = req.nextUrl.searchParams.get("type") || "all";

    const searchQuery = q.split(" ").join(" & ");
    const pageSize = 10;

    const { user } = await validateRequest();

    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const isHashtagSearch = q.startsWith("#");
    const hashtagQuery = isHashtagSearch ? q.slice(1).toLowerCase() : null;

    let posts = [];
    let users = [];
    let nextCursor = null;

    // Search posts
    if (type === "posts" || type === "all") {
      const postsResult = await prisma.post.findMany({
        where: {
          AND: [
            {
              OR: [
                {
                  content: {
                    search: searchQuery,
                  },
                },
                {
                  user: {
                    displayName: {
                      search: searchQuery,
                    },
                  },
                },
                {
                  user: {
                    username: {
                      search: searchQuery,
                    },
                  },
                },
                ...(hashtagQuery
                  ? [
                      {
                        hashtags: {
                          has: hashtagQuery,
                        },
                      },
                    ]
                  : []),
              ],
            },
            ...(emotion ? [{ emotions: emotion }] : []),
          ],
        },
        include: getPostDataInclude(user.id),
        orderBy: { createdAt: "desc" },
        take: pageSize + 1,
        cursor: cursor ? { id: cursor } : undefined,
      });

      posts = postsResult.slice(0, pageSize);
      if (type === "posts") {
        nextCursor =
          postsResult.length > pageSize ? postsResult[pageSize].id : null;
      }
    }

    // Search users
    if (type === "users" || type === "all") {
      const usersResult = await prisma.user.findMany({
        where: {
          AND: [
            {
              NOT: { id: user.id },
            },
            {
              OR: [
                { displayName: { contains: q, mode: "insensitive" } },
                { username: { contains: q, mode: "insensitive" } },
              ],
            },
          ],
        },
        select: getUserDataSelect(user.id),
        take: 20,
        orderBy: { displayName: "asc" },
      });

      users = usersResult;
    }

    if (type === "all") {
      return Response.json({
        posts,
        users,
      });
    } else if (type === "users") {
      return Response.json({
        users,
      });
    } else {
      return Response.json({
        posts,
        nextCursor,
      });
    }
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
