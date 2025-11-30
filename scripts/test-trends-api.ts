/**
 * Test API /api/trends để xem location-based recommendations trên UI
 * Chạy: tsx scripts/test-trends-api.ts [username]
 *
 * Note: Script này test logic của API, không cần authentication thật
 * Để test trên UI, bạn cần đăng nhập và xem phần "Who to follow"
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

async function testTrendsAPI(username?: string) {
  try {
    console.log("=".repeat(60));
    console.log("🧪 Testing /api/trends API - Location-Based Recommendations");
    console.log("=".repeat(60));
    console.log();

    // Lấy user để test
    let targetUser;
    if (username) {
      targetUser = await prisma.user.findFirst({
        where: {
          username: {
            equals: username,
            mode: "insensitive",
          },
        },
        select: {
          id: true,
          username: true,
          displayName: true,
          provinceCode: true,
          districtCode: true,
          wardCode: true,
        },
      });
    } else {
      targetUser = await prisma.user.findFirst({
        where: {
          username: "rivermoore24",
        },
        select: {
          id: true,
          username: true,
          displayName: true,
          provinceCode: true,
          districtCode: true,
          wardCode: true,
        },
      });
    }

    if (!targetUser) {
      console.log(`❌ Không tìm thấy user: ${username || "rivermoore24"}`);
      return;
    }

    console.log(
      `🎯 Target User: ${targetUser.displayName} (@${targetUser.username})`
    );
    console.log(`   ID: ${targetUser.id}`);
    console.log(
      `   Location: ${targetUser.provinceCode} / ${targetUser.districtCode || "N/A"} / ${targetUser.wardCode || "N/A"}`
    );
    console.log();

    // Test logic của API bằng cách gọi trực tiếp recommendFriends
    console.log("🔄 Testing recommendation logic...");
    console.log("   (Simulating /api/trends API call)");
    console.log("   (Có thể mất 30-60 giây để Python API xử lý...)");
    console.log();

    // Lấy data giống như API /api/trends
    const currentUser = await prisma.user.findUnique({
      where: { id: targetUser.id },
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
      console.log("❌ Không tìm thấy user data");
      return;
    }

    const candidateUsers = await prisma.user.findMany({
      where: {
        NOT: { id: targetUser.id },
        followers: { none: { followerId: targetUser.id } },
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
      take: 50,
    });

    // Format data
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
        liked_post_contents: u.likes.map((l) => l.post.content).filter(Boolean),
        comment_contents: u.comments.map((c) => c.content),
        following_ids: u.following.map((f) => f.followingId),
        province_code: u.provinceCode,
        district_code: u.districtCode,
        ward_code: u.wardCode,
      })),
    ];

    // Gọi Python API trực tiếp (giống như /api/trends)
    const PYTHON_API_URL =
      process.env.PYTHON_API_URL || "http://localhost:8001";
    const startTime = Date.now();
    const response = await fetch(`${PYTHON_API_URL}/recommend-friends/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        user_id: targetUser.id,
        users: usersData,
      }),
    });

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ API error (${response.status}):`, errorText);
      return;
    }

    const recommendations = await response.json();
    console.log(`✅ API response sau ${duration}s`);
    console.log();

    // Get full user data
    const recommendedUserIds = recommendations.map((r: any) => r.id);
    const usersToFollow = await prisma.user.findMany({
      where: { id: { in: recommendedUserIds } },
      select: {
        id: true,
        username: true,
        displayName: true,
        provinceCode: true,
        districtCode: true,
        wardCode: true,
      },
    });

    // Sort by similarity
    const recMap = new Map<string, number>(
      recommendations.map((r: any) => [r.id, r.similarity])
    );
    usersToFollow.sort(
      (a, b) => (recMap.get(b.id) ?? 0) - (recMap.get(a.id) ?? 0)
    );

    console.log("📊 Recommendations Analysis:");
    console.log(`   Total recommendations: ${usersToFollow.length}`);
    console.log();

    if (usersToFollow.length === 0) {
      console.log("⚠️  Không có recommendations nào");
      console.log("   Có thể do:");
      console.log("      - Python API không chạy");
      console.log("      - Không có candidate users");
      console.log("      - Threshold quá cao");
    } else {
      // Lấy location info của recommended users
      const recommendedUserIds = usersToFollow.map((u: any) => u.id);
      const recommendedUsersWithLocation = await prisma.user.findMany({
        where: { id: { in: recommendedUserIds } },
        select: {
          id: true,
          username: true,
          displayName: true,
          provinceCode: true,
          districtCode: true,
          wardCode: true,
        },
      });

      const locationMap = new Map(
        recommendedUsersWithLocation.map((u) => [u.id, u])
      );

      console.log(`🎉 Found ${usersToFollow.length} recommendations:`);
      console.log();

      let sameLocationCount = 0;
      let sameProvinceCount = 0;

      usersToFollow.forEach((user: any, index: number) => {
        const locationInfo = locationMap.get(user.id);
        console.log(`${index + 1}. ${user.displayName} (@${user.username})`);

        if (locationInfo) {
          let locationMatch = "";
          if (
            targetUser.provinceCode &&
            locationInfo.provinceCode === targetUser.provinceCode
          ) {
            if (
              targetUser.wardCode &&
              locationInfo.wardCode === targetUser.wardCode
            ) {
              locationMatch =
                "✅ Cùng wardCode + provinceCode (Location bonus!)";
              sameLocationCount++;
            } else {
              locationMatch = "📍 Cùng province, khác ward";
              sameProvinceCount++;
            }
          } else {
            locationMatch = "❌ Khác province";
          }

          console.log(`   ${locationMatch}`);
          console.log(
            `   Location: ${locationInfo.provinceCode || "N/A"} / ${locationInfo.districtCode || "N/A"} / ${locationInfo.wardCode || "N/A"}`
          );
        } else {
          console.log(`   Location: N/A`);
        }
        console.log();
      });

      console.log("---");
      console.log("🎯 Summary:");
      console.log(
        `   Users cùng wardCode + provinceCode: ${sameLocationCount}`
      );
      console.log(`   Users cùng province: ${sameProvinceCount}`);
      console.log(
        `   Users khác location: ${usersToFollow.length - sameLocationCount - sameProvinceCount}`
      );
      console.log();

      if (sameLocationCount > 0) {
        console.log("✅ SUCCESS: Location-based recommendation hoạt động!");
        console.log(
          "   Users cùng location đã được ưu tiên trong recommendations!"
        );
      } else {
        console.log(
          "⚠️  WARNING: Không có users cùng location trong recommendations"
        );
        console.log("   Có thể do:");
        console.log("      - Không có users cùng location trong database");
        console.log("      - Content similarity quá thấp");
        console.log("      - Python API chưa được restart với code mới");
      }
    }

    // Show similarity scores
    console.log("📊 Similarity Scores:");
    recommendations.forEach((rec: any, index: number) => {
      const user = usersToFollow.find((u) => u.id === rec.id);
      if (user) {
        console.log(
          `   ${index + 1}. ${user.displayName}: ${rec.similarity.toFixed(4)}`
        );
      }
    });

    console.log();
    console.log("=".repeat(60));
    console.log("✅ Test completed!");
    console.log("=".repeat(60));
    console.log();
    console.log("💡 Để xem trên UI:");
    console.log(`   1. Đăng nhập với user: ${targetUser.username}`);
    console.log(`   2. Vào trang chủ hoặc profile page`);
    console.log(`   3. Xem phần "Who to follow" ở sidebar`);
  } catch (error) {
    console.error("❌ Error:", error);
    if (error instanceof Error) {
      console.error("   Message:", error.message);
      if (error.message.includes("fetch")) {
        console.error("   💡 Đảm bảo Next.js server đang chạy tại:", BASE_URL);
      }
    }
  } finally {
    await prisma.$disconnect();
  }
}

// Lấy username từ command line arguments
const username = process.argv[2];

testTrendsAPI(username);
