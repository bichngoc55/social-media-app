import { validateRequest } from "@/auth";
import prisma from "@/lib/prisma";
import { getPostDataInclude } from "@/lib/types";
import {
  // getMultimodalEmbedding,
  normalizeVector,
  analyzeQueryEmotion,
  getTextEmbedding,
} from "@/lib/vertex";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const { user } = await validateRequest();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const query = req.nextUrl.searchParams.get("q");
    const limit = parseInt(req.nextUrl.searchParams.get("limit") || "10");
    const offset = parseInt(req.nextUrl.searchParams.get("cursor") || "0");
    // const vectorThreshold = 0.1;
    const topicThreshold = 0.6;
    const textThreshold = 0.05;

    if (!query) {
      return NextResponse.json({ error: "Query is required" }, { status: 400 });
    }
    if (query.startsWith("%")) {
      console.log("[SEARCH] Hashtag search for ", query);
      const hashtag = query.slice(1).toLowerCase();
      const posts = await prisma.post.findMany({
        where: {
          OR: [{ hashtags: { has: hashtag } }, { topics: { has: hashtag } }],
        },
        include: getPostDataInclude(user.id),
        orderBy: { createdAt: "desc" },
        take: 10,
        skip: offset,
      });
      return NextResponse.json({ posts, emotionAnalysis: null });
    }

    const emotionAnalysis = await analyzeQueryEmotion(query);

    // const [multimodalEmbedding, textEmbedding] = await Promise.all([
    //   getMultimodalEmbedding(query),
    //   getTextEmbedding(query),
    // ]);
    const textEmbedding = await getTextEmbedding(query);
    const normalizedText = normalizeVector(textEmbedding);
    const textVectorString = `[${normalizedText.join(",")}]`;
    const results = await prisma.$queryRaw<
      Array<{
        id: string;
        content: string;
        combined_score: number;
      }>
    >`
      SELECT 
        id,
        content,
        GREATEST(
          COALESCE(
            (SELECT MAX(1 - (t_emb <=> ${textVectorString}::vector))
             FROM unnest("topicEmbeddings") as t_emb), 0
          ),
          similarity(content, ${query})
        ) as combined_score

      FROM "posts"
      WHERE 
        COALESCE(
          (SELECT MAX(1 - (t_emb <=> ${textVectorString}::vector))
           FROM unnest("topicEmbeddings") as t_emb), 0
        ) > ${topicThreshold}
        OR 
        similarity(content, ${query}) > ${textThreshold}
      
      ORDER BY combined_score DESC
      LIMIT ${limit}
      OFFSET ${offset};  -- <--- THIS IS THE FIX
    `;
    console.log(
      `[SEARCH] Found ${results.length} matching posts for query "${query}"`
    );
    console.log("search ressult ", results);
    if (results.length === 0) {
      return NextResponse.json({ posts: [], query, emotionAnalysis });
    }
    const postIds = results.map((r) => r.id);

    const posts = await prisma.post.findMany({
      where: {
        id: { in: postIds },
      },
      include: getPostDataInclude(user.id),
    });
    const sortedPosts = results
      .map((result) => posts.find((p) => p.id === result.id))
      .filter((p) => p !== undefined);
    const nextCursor = results.length === limit ? offset + limit : null;
    return NextResponse.json({
      posts: sortedPosts,
      nextCursor,
      emotionAnalysis,
    });
  } catch (error) {
    console.error("Search error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
