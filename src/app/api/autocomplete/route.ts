import { validateRequest } from "@/auth";
import prisma from "@/lib/prisma";
import { getMultimodalEmbedding, normalizeVector } from "@/lib/vertex";
import { NextRequest, NextResponse } from "next/server";

// Cache for embeddings to avoid repeated API calls
const embeddingCache = new Map<string, number[]>();
const EMBEDDING_CACHE_SIZE = 100;

export async function GET(req: NextRequest) {
  try {
    const { user } = await validateRequest();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const query = req.nextUrl.searchParams.get("q");
    const limit = parseInt(req.nextUrl.searchParams.get("limit") || "10");

    if (!query || query.trim().length === 0) {
      return NextResponse.json({ suggestions: [] });
    }

    const trimmedQuery = query.trim().toLowerCase();

    // If query is too short, use only prefix matching (faster)
    if (trimmedQuery.length < 3) {
      const results = await prisma.$queryRaw<
        Array<{ id: string; content: string; userId: string }>
      >`
        SELECT id, content, "userId"
        FROM "posts"
        WHERE content ILIKE ${trimmedQuery + "%"}
        ORDER BY "createdAt" DESC
        LIMIT ${limit};
      `;

      return NextResponse.json({
        suggestions: results.map((r) => ({
          id: r.id,
          content:
            r.content.substring(0, 100) + (r.content.length > 100 ? "..." : ""),
          userId: r.userId,
        })),
        query: trimmedQuery,
      });
    }

    // Check embedding cache
    let queryEmbedding: number[];
    if (embeddingCache.has(trimmedQuery)) {
      queryEmbedding = embeddingCache.get(trimmedQuery)!;
    } else {
      queryEmbedding = await getMultimodalEmbedding(trimmedQuery);

      // Manage cache size
      if (embeddingCache.size >= EMBEDDING_CACHE_SIZE) {
        const firstKey = embeddingCache.keys().next().value;
        embeddingCache.delete(firstKey);
      }
      embeddingCache.set(trimmedQuery, queryEmbedding);
    }

    const normalizedQuery = normalizeVector(queryEmbedding);

    // Optimized query: prioritize prefix matches, then vector similarity
    const results = await prisma.$queryRaw<
      Array<{
        id: string;
        content: string;
        userId: string;
        similarity: number;
      }>
    >`
      WITH ranked_posts AS (
        SELECT 
          id, 
          content,
          "userId",
          (1 - (embedding <=> ${normalizedQuery}::vector)) as similarity,
          CASE 
            WHEN content ILIKE ${trimmedQuery + "%"} THEN 1
            ELSE 0
          END as is_prefix_match
        FROM "posts"
        WHERE 
          embedding IS NOT NULL
          AND (
            content ILIKE ${trimmedQuery + "%"}
            OR (1 - (embedding <=> ${normalizedQuery}::vector)) > 0.15
          )
      )
      SELECT id, content, "userId", similarity
      FROM ranked_posts
      ORDER BY 
        is_prefix_match DESC,
        similarity DESC
      LIMIT ${limit};
    `;

    return NextResponse.json({
      suggestions: results.map((r) => ({
        id: r.id,
        content:
          r.content.substring(0, 100) + (r.content.length > 100 ? "..." : ""),
        userId: r.userId,
        similarity: r.similarity,
      })),
      query: trimmedQuery,
    });
  } catch (error) {
    console.error("Autocomplete error:", error);
    return NextResponse.json(
      { error: "Internal server error", suggestions: [] },
      { status: 500 }
    );
  }
}
