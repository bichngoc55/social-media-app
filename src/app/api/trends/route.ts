import { validateRequest } from "@/auth";
import prisma from "@/lib/prisma";
import { getUserDataSelect } from "@/lib/types";
import { formatNumber } from "@/lib/utils";
import { unstable_cache } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { recommendFriends } from "@/lib/ai-api";

// Set max duration for Vercel serverless functions
export const maxDuration = 120; // 120 seconds (2 phút) - vì Python API cần thời gian xử lý embeddings

const getTrendingTopics = unstable_cache(
  async () => {
    const result = await prisma.$queryRaw<
      { hashtag: string; count: bigint }[]
    >` 
            SELECT LOWER(unnest(regexp_matches(content, '#[[:alnum:]_]+', 'g'))) AS hashtag, COUNT(*) AS count
            FROM posts
            GROUP BY (hashtag)
            ORDER BY count DESC, hashtag ASC
            LIMIT 5
        `;

    return result.map((row) => ({
      hashtag: row.hashtag,
      count: Number(row.count),
    }));
  },
  ["trending_topics"],
  {
    revalidate: 3 * 60 * 60,
  }
);

export async function GET(req: NextRequest) {
  try {
    // Check if request was aborted
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
      // Try AI recommendations first, fallback to simple query
      (async () => {
        // Check if request was aborted
        if (req.signal?.aborted) {
          throw new Error("Request aborted");
        }

        try {
          console.log("🤖 Bắt đầu gọi Python AI API...");

          // Fetch user data for AI recommendations
          const currentUser = await prisma.user.findUnique({
            where: { id: user.id },
            select: {
              id: true,
              username: true,
              displayName: true,
              provinceCode: true,
              districtCode: true,
              wardCode: true,
              posts: {
                where: { privacy: "PUBLIC" },
                select: { content: true },
                take: 100,
              },
              likes: {
                select: {
                  post: {
                    select: { content: true },
                  },
                },
                take: 100,
              },
              comments: {
                select: { content: true },
                take: 100,
              },
              following: {
                select: { followingId: true },
              },
            },
          });

          if (!currentUser) {
            throw new Error("User not found");
          }

          // Get candidate users
          const candidateUsers = await prisma.user.findMany({
            where: {
              NOT: { id: user.id },
              followers: { none: { followerId: user.id } },
              posts: { some: { privacy: "PUBLIC" } },
            },
            select: {
              id: true,
              username: true,
              displayName: true,
              provinceCode: true,
              districtCode: true,
              wardCode: true,
              posts: {
                where: { privacy: "PUBLIC" },
                select: { content: true },
                take: 50,
              },
              likes: {
                select: {
                  post: {
                    select: { content: true },
                  },
                },
                take: 50,
              },
              comments: {
                select: { content: true },
                take: 50,
              },
              following: {
                select: { followingId: true },
              },
            },
            take: 50, // Giảm từ 200 xuống 50 để Python API xử lý nhanh hơn
          });

          // Format for AI API
          console.log(
            `📊 Sending ${candidateUsers.length + 1} users to Python API...`
          );

          const usersData = [
            {
              id: currentUser.id,
              username: currentUser.username,
              displayName: currentUser.displayName,
              post_contents: currentUser.posts.map((p) => p.content),
              liked_post_contents: currentUser.likes
                .map((l) => l.post.content)
                .filter(Boolean),
              comment_contents: currentUser.comments.map((c) => c.content),
              following_ids: currentUser.following.map((f) => f.followingId),
              province_code: currentUser.provinceCode,
              district_code: currentUser.districtCode,
              ward_code: currentUser.wardCode,
            },
            ...candidateUsers.map((u) => ({
              id: u.id,
              username: u.username,
              displayName: u.displayName,
              post_contents: u.posts.map((p) => p.content),
              liked_post_contents: u.likes
                .map((l) => l.post.content)
                .filter(Boolean),
              comment_contents: u.comments.map((c) => c.content),
              following_ids: u.following.map((f) => f.followingId),
              province_code: u.provinceCode,
              district_code: u.districtCode,
              ward_code: u.wardCode,
            })),
          ];

          // Check if request was aborted before calling AI API
          if (req.signal?.aborted) {
            throw new Error("Request aborted");
          }

          // Call AI API
          console.log("⏳ Đang gọi Python AI API (có thể mất 30-60s)...");
          console.log(
            `   Target user: ${currentUser.username} (${currentUser.id})`
          );
          console.log(
            `   Location: ${currentUser.provinceCode} / ${currentUser.districtCode || "N/A"} / ${currentUser.wardCode || "N/A"}`
          );
          console.log(`   Candidate users: ${candidateUsers.length}`);
          const startTime = Date.now();
          const recommendations = await recommendFriends(user.id, usersData);
          const duration = ((Date.now() - startTime) / 1000).toFixed(2);
          console.log(
            `✅ Python AI API trả về sau ${duration}s với ${recommendations.length} recommendations`
          );

          // Log location info của recommendations
          if (recommendations.length > 0) {
            console.log("   Recommendations:");
            recommendations.slice(0, 3).forEach((r: any) => {
              const candidate = candidateUsers.find((u) => u.id === r.id);
              if (candidate) {
                const locationMatch =
                  candidate.provinceCode === currentUser.provinceCode
                    ? candidate.wardCode === currentUser.wardCode
                      ? "✅ Cùng ward+province"
                      : "📍 Cùng province"
                    : "❌ Khác province";
                console.log(
                  `      - ${r.displayName}: ${r.similarity.toFixed(4)} (${locationMatch})`
                );
              }
            });
          }

          // Nếu không có recommendations, trả về empty array (không fallback)
          if (recommendations.length === 0) {
            console.log(
              "ℹ️ Python AI API không tìm thấy recommendations phù hợp (threshold quá cao hoặc không có users tương tự)"
            );
            return [];
          }

          // Check again after AI API call (nhưng không throw nếu đã có kết quả)
          if (req.signal?.aborted) {
            console.log(
              "⚠️ Request bị abort nhưng đã có kết quả từ AI, vẫn trả về recommendations"
            );
            // Vẫn trả về kết quả, không throw error
          }

          // Get full user data
          const recommendedUserIds = recommendations.map((r) => r.id);
          const recommendedUsers = await prisma.user.findMany({
            where: { id: { in: recommendedUserIds } },
            select: getUserDataSelect(user.id, false),
          });

          // Sort by similarity (giữ nguyên thứ tự từ Python API - đã được sort với location priority)
          const userMap = new Map(recommendedUsers.map((u) => [u.id, u]));
          const sortedUsers = recommendations
            .map((rec) => {
              const user = userMap.get(rec.id);
              if (user) {
                // Add similarity score để debug
                (user as any).similarity = rec.similarity;
              }
              return user;
            })
            .filter(Boolean);

          console.log(
            `✅ AI recommendations: ${sortedUsers.length} users (similarities: ${recommendations.map((r) => r.similarity.toFixed(2)).join(", ")})`
          );

          // Log location info
          sortedUsers.slice(0, 3).forEach((u: any) => {
            const candidate = candidateUsers.find((c) => c.id === u.id);
            if (candidate) {
              const locationMatch =
                candidate.provinceCode === currentUser.provinceCode
                  ? candidate.wardCode === currentUser.wardCode
                    ? "✅ Cùng ward+province"
                    : "📍 Cùng province"
                  : "❌ Khác province";
              console.log(
                `   - ${u.displayName}: ${u.similarity?.toFixed(4) || "N/A"} (${locationMatch})`
              );
            }
          });

          return sortedUsers;
        } catch (aiError) {
          console.error("⚠️ AI recommendations failed, using fallback");
          console.error("   Error:", aiError);
          if (aiError instanceof Error) {
            console.error("   Message:", aiError.message);
            console.error("   Stack:", aiError.stack);
          }
          console.log(
            "   💡 Fallback: Using simple query (orderBy createdAt desc)"
          );
          // Fallback to simple query
          return prisma.user.findMany({
            where: {
              NOT: { id: user.id },
              followers: { none: { followerId: user.id } },
            },
            select: getUserDataSelect(user.id, false),
            take: 5,
            orderBy: { createdAt: "desc" },
          });
        }
      })(),
      getTrendingTopics(),
    ]);

    // Final check before sending response
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
    // Check if error is due to abort
    if (
      req.signal?.aborted ||
      (error instanceof Error && error.name === "AbortError")
    ) {
      return NextResponse.json(
        { usersToFollow: [], trendingTopics: [] },
        { status: 499 }
      );
    }

    console.error("Error fetching trends:", error);
    return NextResponse.json(
      { error: "Failed to fetch trends" },
      { status: 500 }
    );
  }
}
