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
    // const normalizedMultimodal = normalizeVector(multimodalEmbedding);
    const normalizedText = normalizeVector(textEmbedding);

    // Convert to strings for SQL
    // const multimodalString = `[${normalizedMultimodal.join(",")}]`;
    const textVectorString = `[${normalizedText.join(",")}]`;
    // const results = await prisma.$queryRaw<
    //   Array<{
    //     id: string;
    //     content: string;
    //     vector_score: number; // Score for main post content
    //     topic_score: number; // Score for the best matching topic
    //     text_score: number; // Score for keyword match
    //     combined_score: number; // The winner of the three
    //   }>
    // >`
    //   SELECT
    //     id,
    //     content,

    //     -- 1. Main Embedding Score (1408 dims)
    //     (1 - (embedding <=> ${multimodalString}::vector)) as vector_score,

    //     -- 2. Topic Embedding Score (768 dims array)
    //     -- We unnest the array and find the single highest match
    //     COALESCE(
    //       (
    //         SELECT MAX(1 - (t_emb <=> ${textVectorString}::vector))
    //         FROM unnest("topicEmbeddings") as t_emb
    //       ),
    //       0
    //     ) as topic_score,

    //     -- 3. Text Keyword Score
    //     similarity(content, ${query}) as text_score,

    //     -- 4. Combined Score (Winner takes all)
    //     GREATEST(
    //       (1 - (embedding <=> ${multimodalString}::vector)),
    //       COALESCE(
    //         (
    //           SELECT MAX(1 - (t_emb <=> ${textVectorString}::vector))
    //           FROM unnest("topicEmbeddings") as t_emb
    //         ),
    //         0
    //       ),
    //       similarity(content, ${query})
    //     ) as combined_score

    //   FROM "posts"
    //   WHERE
    //     -- Filter: At least one method must pass its threshold
    //     (1 - (embedding <=> ${multimodalString}::vector)) > ${vectorThreshold}
    //     OR
    //     similarity(content, ${query}) > ${textThreshold}
    //     OR
    //     COALESCE(
    //       (
    //         SELECT MAX(1 - (t_emb <=> ${textVectorString}::vector))
    //         FROM unnest("topicEmbeddings") as t_emb
    //       ),
    //       0
    //     ) > ${topicThreshold}

    //    ORDER BY combined_score DESC
    //   LIMIT ${limit};
    // `;
    // const results = await prisma.$queryRaw<
    //   Array<{
    //     id: string;
    //     content: string;
    //     topic_score: number;
    //     text_score: number;
    //     combined_score: number;
    //   }>
    // >`
    //   SELECT
    //     id,
    //     content,

    //     -- A. Calculate Topic Score (Unnest array -> Find best match)
    //     COALESCE(
    //       (
    //         SELECT MAX(1 - (t_emb <=> ${textVectorString}::vector))
    //         FROM unnest("topicEmbeddings") as t_emb
    //       ),
    //       0
    //     ) as topic_score,

    //     -- B. Calculate Text Keyword Score
    //     similarity(content, ${query}) as text_score,

    //     -- C. Combined Score (Winner of Topic vs Text)
    //     GREATEST(
    //       COALESCE(
    //         (
    //           SELECT MAX(1 - (t_emb <=> ${textVectorString}::vector))
    //           FROM unnest("topicEmbeddings") as t_emb
    //         ),
    //         0
    //       ),
    //       similarity(content, ${query})
    //     ) as combined_score

    //   FROM "posts"
    //   WHERE
    //     -- Filter: Must match a Topic OR contain the keywords
    //     COALESCE(
    //       (
    //         SELECT MAX(1 - (t_emb <=> ${textVectorString}::vector))
    //         FROM unnest("topicEmbeddings") as t_emb
    //       ),
    //       0
    //     ) > ${topicThreshold}
    //     OR
    //     similarity(content, ${query}) > ${textThreshold}

    //    ORDER BY combined_score DESC
    //   LIMIT ${limit};
    //   OFFSET ${offset};
    // `;
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
    // console.log(
    //   `[SEARCH] Found ${results.length} matching posts for query "${query}"`
    // );
    // console.log("search ressult ", results);
    if (results.length === 0) {
      return NextResponse.json({ posts: [], query, emotionAnalysis });
    }

    // 3. Fetch Full Data
    const postIds = results.map((r) => r.id);
    const posts = await prisma.post.findMany({
      where: { id: { in: postIds } },
      include: getPostDataInclude(user.id),
    });

    // const postsWithSimilarity = posts.map((post) => {
    //   const result = results.find((r) => r.id === post.id);
    //   return {
    //     ...post,
    //     similarity: result?.combined_score || 0,
    //     debug: {
    //       vectorScore: result?.vector_score,
    //       textScore: result?.text_score,
    //       isTextMatch: (result?.text_score || 0) > textThreshold,
    //       isVectorMatch: (result?.vector_score || 0) > vectorThreshold,
    //     },
    //   };
    // });
    const postsWithSimilarity = posts.map((post) => {
      const result = results.find((r) => r.id === post.id);
      return {
        ...post,
        similarity: result?.combined_score || 0,
        // debug: {
        //   topicScore: result?.topic_score,
        //   textScore: result?.text_score,
        //   matchedStrategy:
        //     result?.combined_score === result?.topic_score
        //       ? "TOPIC"
        //       : "KEYWORD",
        // },
      };
    });

    postsWithSimilarity.sort((a, b) => b.similarity - a.similarity);
    const nextCursor = results.length === limit ? offset + limit : null;
    return NextResponse.json({
      posts: postsWithSimilarity,
      // query,
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
