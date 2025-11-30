/**
 * Test trực tiếp Python API để xác nhận location-based recommendation logic
 * Chạy: tsx scripts/test-python-api-direct.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const PYTHON_API_URL = process.env.PYTHON_API_URL || "http://localhost:8001";

interface UserDataForAPI {
  id: string;
  username: string;
  displayName: string;
  post_contents: string[];
  liked_post_contents: string[];
  comment_contents: string[];
  following_ids: string[];
  province_code?: string | null;
  district_code?: string | null;
  ward_code?: string | null;
}

async function testPythonAPIDirect() {
  try {
    console.log("=".repeat(60));
    console.log(
      "🧪 Testing Python API Directly - Location-Based Recommendation"
    );
    console.log("=".repeat(60));
    console.log();

    // Lấy River Moore
    const rivermoore = await prisma.user.findUnique({
      where: { username: "rivermoore24" },
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

    if (!rivermoore) {
      console.log("❌ Không tìm thấy River Moore");
      return;
    }

    console.log(
      `🎯 Target User: ${rivermoore.displayName} (@${rivermoore.username})`
    );
    console.log(
      `   Location: ${rivermoore.provinceCode} / ${rivermoore.districtCode || "N/A"} / ${rivermoore.wardCode}`
    );
    console.log();

    // Lấy một số users để test, bao gồm users cùng location
    const testUsers = await prisma.user.findMany({
      where: {
        NOT: { id: rivermoore.id },
        OR: [
          // Users cùng location
          {
            provinceCode: rivermoore.provinceCode,
            wardCode: rivermoore.wardCode,
          },
          // Users cùng province nhưng khác ward
          {
            provinceCode: rivermoore.provinceCode,
            wardCode: { not: rivermoore.wardCode },
          },
          // Users khác province (để so sánh)
          {
            provinceCode: { not: rivermoore.provinceCode },
          },
        ],
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
      take: 10,
    });

    console.log(`📊 Found ${testUsers.length} test users:`);
    testUsers.forEach((u) => {
      const locationMatch =
        u.provinceCode === rivermoore.provinceCode
          ? u.wardCode === rivermoore.wardCode
            ? "📍 Cùng ward + province"
            : "📍 Cùng province, khác ward"
          : "❌ Khác province";
      console.log(
        `   - ${u.displayName} (@${u.username}): ${locationMatch} (${u.provinceCode} / ${u.districtCode || "N/A"} / ${u.wardCode || "N/A"})`
      );
    });
    console.log();

    // Format data cho Python API
    const usersData: UserDataForAPI[] = [
      {
        id: rivermoore.id,
        username: rivermoore.username,
        displayName: rivermoore.displayName,
        post_contents: rivermoore.posts.map((p) => p.content),
        liked_post_contents: rivermoore.likes
          .map((l) => l.post.content)
          .filter(Boolean),
        comment_contents: rivermoore.comments.map((c) => c.content),
        following_ids: rivermoore.following.map((f) => f.followingId),
        province_code: rivermoore.provinceCode,
        district_code: rivermoore.districtCode,
        ward_code: rivermoore.wardCode,
      },
      ...testUsers.map((u) => ({
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

    console.log(`🔄 Sending ${usersData.length} users to Python API...`);
    console.log(`   URL: ${PYTHON_API_URL}/recommend-friends/`);
    console.log();

    // Gọi Python API trực tiếp
    const startTime = Date.now();
    const response = await fetch(`${PYTHON_API_URL}/recommend-friends/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        user_id: rivermoore.id,
        users: usersData,
      }),
    });

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Python API error (${response.status}):`, errorText);
      return;
    }

    const recommendations = await response.json();
    console.log(`✅ Python API response sau ${duration}s`);
    console.log(`   Received ${recommendations.length} recommendations`);
    console.log();

    // Phân tích kết quả
    console.log("📊 Recommendations Analysis:");
    console.log();

    const userMap = new Map(testUsers.map((u) => [u.id, u]));

    recommendations.forEach((rec: any, index: number) => {
      const user = userMap.get(rec.id);
      console.log(`${index + 1}. ${rec.displayName} (@${rec.username})`);
      console.log(`   Similarity: ${rec.similarity.toFixed(4)}`);

      if (user) {
        let locationInfo = "";
        if (user.provinceCode === rivermoore.provinceCode) {
          if (user.wardCode === rivermoore.wardCode) {
            locationInfo =
              "✅ Cùng wardCode + provinceCode (Location bonus cao nhất!)";
          } else {
            locationInfo = "📍 Cùng province, khác ward";
          }
        } else {
          locationInfo = "❌ Khác province";
        }

        console.log(`   ${locationInfo}`);
        console.log(
          `   Location: ${user.provinceCode} / ${user.districtCode || "N/A"} / ${user.wardCode || "N/A"}`
        );
      }
      console.log();
    });

    // Kiểm tra xem users cùng location có được recommend không
    const sameLocationUsers = testUsers.filter(
      (u) =>
        u.provinceCode === rivermoore.provinceCode &&
        u.wardCode === rivermoore.wardCode
    );

    const recommendedSameLocation = recommendations.filter((r: any) =>
      sameLocationUsers.some((u) => u.id === r.id)
    );

    console.log("---");
    console.log("🎯 Location Matching Results:");
    console.log(
      `   Users cùng wardCode + provinceCode: ${sameLocationUsers.length}`
    );
    console.log(
      `   Recommended cùng location: ${recommendedSameLocation.length}`
    );

    if (recommendedSameLocation.length > 0) {
      console.log("   ✅ SUCCESS: Location-based recommendation hoạt động!");
      recommendedSameLocation.forEach((r: any) => {
        console.log(
          `      - ${r.displayName} (@${r.username}): ${r.similarity.toFixed(4)}`
        );
      });
    } else {
      console.log("   ⚠️  WARNING: Users cùng location không được recommend");
      console.log("   Có thể do:");
      console.log("      - Content similarity quá thấp");
      console.log("      - Location bonus chưa đủ mạnh");
      console.log("      - Threshold vẫn còn cao");
    }

    console.log();
    console.log("=".repeat(60));
    console.log("✅ Test completed!");
    console.log("=".repeat(60));
  } catch (error) {
    console.error("❌ Error:", error);
    if (error instanceof Error) {
      console.error("   Message:", error.message);
      if (error.message.includes("fetch")) {
        console.error(
          "   💡 Đảm bảo Python API đang chạy tại:",
          PYTHON_API_URL
        );
        console.error(
          "   Chạy: cd python-api && uvicorn main:app --reload --port 8001"
        );
      }
    }
  } finally {
    await prisma.$disconnect();
  }
}

testPythonAPIDirect();
