import { validateRequest } from "@/auth";
import prisma from "@/lib/prisma";
import { getPostDataInclude } from "@/lib/types";
import { getMultimodalEmbedding, normalizeVector } from "@/lib/vertex";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const { user } = await validateRequest();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const query = req.nextUrl.searchParams.get("q");
    const limit = parseInt(req.nextUrl.searchParams.get("limit") || "10");
    const vectorThreshold = 0.1;

    const textThreshold = 0.05;

    if (!query) {
      return NextResponse.json({ error: "Query is required" }, { status: 400 });
    }

    const queryEmbedding = await getMultimodalEmbedding(query);
    const normalizedQuery = normalizeVector(queryEmbedding);

    const results = await prisma.$queryRaw<
      Array<{
        id: string;
        vector_score: number;
        text_score: number;
        combined_score: number;
      }>
    >`
      SELECT 
        id,
         (1 - (embedding <=> ${normalizedQuery}::vector)) as vector_score,
        
         similarity(content, ${query}) as text_score,
        
         GREATEST(
          (1 - (embedding <=> ${normalizedQuery}::vector)), 
          similarity(content, ${query})
        ) as combined_score

      FROM "posts"
      WHERE 
         (1 - (embedding <=> ${normalizedQuery}::vector)) > ${vectorThreshold}
        OR 
        similarity(content, ${query}) > ${textThreshold}
      
       ORDER BY combined_score DESC
      LIMIT ${limit};
    `;

    if (results.length === 0) {
      return NextResponse.json({ posts: [], query });
    }

    // 3. Fetch Full Data
    const postIds = results.map((r) => r.id);
    const posts = await prisma.post.findMany({
      where: { id: { in: postIds } },
      include: getPostDataInclude(user.id),
    });

    const postsWithSimilarity = posts.map((post) => {
      const result = results.find((r) => r.id === post.id);
      return {
        ...post,
        similarity: result?.combined_score || 0,
        debug: {
          vectorScore: result?.vector_score,
          textScore: result?.text_score,
          isTextMatch: (result?.text_score || 0) > textThreshold,
          isVectorMatch: (result?.vector_score || 0) > vectorThreshold,
        },
      };
    });

    postsWithSimilarity.sort((a, b) => b.similarity - a.similarity);

    return NextResponse.json({
      posts: postsWithSimilarity,
      query,
    });
  } catch (error) {
    console.error("Search error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
