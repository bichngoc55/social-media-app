import { validateRequest } from "@/auth";
import prisma from "@/lib/prisma";
import { unstable_cache } from "next/cache";
import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 30;

const getTrendingTopics = unstable_cache(
  async () => {
    // Get all topics with their embeddings and counts from last 7 days
    const result = await prisma.$queryRaw<
      { topic: string; embedding: string; count: bigint }[]
    >`
      SELECT 
        LOWER(TRIM(topic)) AS topic,
        topic_emb::text AS embedding,
        COUNT(*) AS count
      FROM posts,
      LATERAL unnest(topics) WITH ORDINALITY AS t(topic, ord)
      LEFT JOIN LATERAL unnest("topicEmbeddings") WITH ORDINALITY AS te(topic_emb, emb_ord)
        ON t.ord = te.emb_ord
      WHERE array_length(topics, 1) > 0
        AND "createdAt" >= NOW() - INTERVAL '40 days'
        AND topic_emb IS NOT NULL
      GROUP BY LOWER(TRIM(topic)), topic_emb
      ORDER BY count DESC
      LIMIT 50
    `;

    if (result.length === 0) {
      return [];
    }

    // Group similar topics using cosine similarity
    const groupedTopics: Map<
      string,
      { topic: string; count: number; embedding: number[] }
    > = new Map();
    const SIMILARITY_THRESHOLD = 0.85; // Topics with >85% similarity are considered the same

    for (const row of result) {
      const topic = row.topic;
      const count = Number(row.count);
      const embedding = row.embedding
        .slice(1, -1)
        .split(",")
        .map((v) => parseFloat(v));

      let merged = false;

      // Check if this topic is similar to any existing group
      for (const [groupTopic, groupData] of groupedTopics) {
        const similarity = cosineSimilarity(embedding, groupData.embedding);

        if (similarity > SIMILARITY_THRESHOLD) {
          // Merge with existing group - keep the more common/shorter name
          groupData.count += count;
          if (
            count > groupedTopics.get(groupTopic)!.count ||
            topic.length < groupTopic.length
          ) {
            groupedTopics.delete(groupTopic);
            groupedTopics.set(topic, {
              topic,
              count: groupData.count,
              embedding,
            });
          }
          merged = true;
          break;
        }
      }

      if (!merged) {
        groupedTopics.set(topic, { topic, count, embedding });
      }
    }

    // Sort by count and return top 4
    return Array.from(groupedTopics.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 4)
      .map((item) => ({
        hashtag: "#" + item.topic,
        count: item.count,
      }));
  },
  ["trending_topics"],
  {
    revalidate: 60,
  }
);

// Helper function to calculate cosine similarity
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
  return magnitude === 0 ? 0 : dotProduct / magnitude;
}

export async function GET(req: NextRequest) {
  try {
    if (req.signal?.aborted) {
      return NextResponse.json(
        { usersToFollow: [], trendingTopics: [] },
        { status: 499 }
      );
    }

    const { user } = await validateRequest();

    if (!user) {
      return NextResponse.json({ usersToFollow: [], trendingTopics: [] });
    }

    const [usersToFollow, trendingTopics] = await Promise.all([
      (async () => {
        try {
          if (req.signal?.aborted) {
            return [];
          }

          console.log("[TRENDS] Calling recommend-friends API...");
          const baseUrl =
            process.env.NEXT_PUBLIC_BASE_URL ||
            `http://localhost:${process.env.PORT || 3000}`;
          const response = (await fetch(`${baseUrl}/api/ai/recommend-friends`, {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
              Cookie: req.headers.get("cookie") || "",
            },
          }).then((res) => res.json())) as { users: any[] };

          console.log(
            "[TRENDS] Received",
            response.users?.length || 0,
            "users"
          );
          return response.users?.slice(0, 5) || [];
        } catch (error) {
          console.error("[TRENDS] Error fetching users:", error);
          return [];
        }
      })(),
      getTrendingTopics(),
    ]);
    console.log("[TRENDS] Final usersToFollow:", usersToFollow.length);

    if (req.signal?.aborted) {
      return NextResponse.json(
        { usersToFollow: [], trendingTopics: [] },
        { status: 499 }
      );
    }

    return NextResponse.json({
      usersToFollow,
      trendingTopics,
    });
  } catch (error) {
    if (
      req.signal?.aborted ||
      (error instanceof Error && error.name === "AbortError")
    ) {
      return NextResponse.json(
        { usersToFollow: [], trendingTopics: [] },
        { status: 499 }
      );
    }

    return NextResponse.json(
      { error: "Failed to fetch trends" },
      { status: 500 }
    );
  }
}
