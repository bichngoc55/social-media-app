/**
 * Test AI Recommendations với location data
 * Chạy: tsx scripts/test-ai-with-location.ts [userId]
 */

import { PrismaClient } from "@prisma/client";
import { recommendFriends } from "../src/lib/ai-api";

const prisma = new PrismaClient();

async function testAIWithLocation(userId?: string) {
  try {
    console.log("=".repeat(60));
    console.log("🧪 Testing AI Recommendations với Location Data");
    console.log("=".repeat(60));
    console.log();

    // Lấy user để test (có thể là userId hoặc username)
    let targetUser;
    if (userId) {
      // Thử tìm theo ID trước
      targetUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, username: true, displayName: true },
      });

      // Nếu không tìm thấy, thử tìm theo username
      if (!targetUser) {
        targetUser = await prisma.user.findFirst({
          where: {
            username: {
              equals: userId,
              mode: "insensitive",
            },
          },
          select: { id: true, username: true, displayName: true },
        });
      }

      if (!targetUser) {
        console.log(`❌ Không tìm thấy user với ID/username: ${userId}`);
        return;
      }
    } else {
      // Lấy user đầu tiên có posts và location
      targetUser = await prisma.user.findFirst({
        where: {
          posts: { some: { privacy: "PUBLIC" } },
          provinceCode: { not: null },
        },
        select: { id: true, username: true, displayName: true },
        orderBy: { createdAt: "desc" },
      });

      if (!targetUser) {
        console.log("❌ Không tìm thấy user nào có posts và location!");
        console.log("   Hãy set location cho user trước (Edit Profile)");
        return;
      }
    }

    console.log(
      `🎯 Target User: ${targetUser.displayName} (@${targetUser.username})`
    );
    console.log(`   ID: ${targetUser.id}`);
    console.log();

    // Fetch data với location
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
      console.log("❌ Không tìm thấy user data!");
      return;
    }

    console.log("📊 User Data:");
    console.log(`   Posts: ${currentUser.posts.length}`);
    console.log(`   Liked posts: ${currentUser.likes.length}`);
    console.log(`   Comments: ${currentUser.comments.length}`);
    console.log(`   Following: ${currentUser.following.length}`);
    console.log(
      `   Location: ${currentUser.provinceCode || "N/A"} / ${currentUser.districtCode || "N/A"} / ${currentUser.wardCode || "N/A"}`
    );
    console.log();

    // Fetch candidate users (ưu tiên users có location)
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

    console.log(`📊 Found ${candidateUsers.length} candidate users`);

    // Count users với location
    const usersWithLocation = candidateUsers.filter(
      (u) => u.provinceCode || u.districtCode || u.wardCode
    );
    console.log(`   Users có location: ${usersWithLocation.length}`);

    // Count users cùng tỉnh
    if (currentUser.provinceCode) {
      const sameProvince = candidateUsers.filter(
        (u) => u.provinceCode === currentUser.provinceCode
      );
      console.log(`   Users cùng tỉnh: ${sameProvince.length}`);
    }
    console.log();

    if (candidateUsers.length === 0) {
      console.log("⚠️  Không có candidate users để recommend!");
      return;
    }

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

    console.log("🤖 Calling Python AI API với location data...");
    console.log("   (Có thể mất 30-60 giây...)");
    console.log();

    const startTime = Date.now();
    const recommendations = await recommendFriends(targetUser.id, usersData);
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log(`✅ AI API response sau ${duration}s`);
    console.log();

    // Hiển thị kết quả với location info
    if (recommendations.length === 0) {
      console.log("⚠️  Không có recommendations nào");
    } else {
      console.log(`🎉 Found ${recommendations.length} recommendations:`);
      console.log();

      // Show all recommendations with location info
      for (let i = 0; i < recommendations.length; i++) {
        const rec = recommendations[i];
        const user = candidateUsers.find((u) => u.id === rec.id);

        console.log(`${i + 1}. ${rec.displayName} (@${rec.username})`);
        console.log(`   Similarity: ${rec.similarity.toFixed(4)}`);

        if (user) {
          // Check location match
          let locationMatch = "";
          let locationDetails = "";

          if (currentUser.provinceCode && user.provinceCode) {
            if (user.provinceCode === currentUser.provinceCode) {
              locationMatch += "📍 Cùng tỉnh";
              locationDetails = `Province: ${user.provinceCode}`;

              if (currentUser.districtCode && user.districtCode) {
                if (user.districtCode === currentUser.districtCode) {
                  locationMatch += " + cùng quận";
                  locationDetails += ` / District: ${user.districtCode}`;

                  if (currentUser.wardCode && user.wardCode) {
                    if (user.wardCode === currentUser.wardCode) {
                      locationMatch += " + cùng phường";
                      locationDetails += ` / Ward: ${user.wardCode}`;
                    } else {
                      locationDetails += ` / Ward: ${user.wardCode} (khác)`;
                    }
                  }
                } else {
                  locationDetails += ` / District: ${user.districtCode} (khác)`;
                }
              }
            } else {
              locationDetails = `Province: ${user.provinceCode} (khác)`;
            }
          } else {
            locationDetails = "N/A";
          }

          if (locationMatch) {
            console.log(`   ${locationMatch} (Location bonus applied!)`);
            console.log(`   ${locationDetails}`);
          } else {
            console.log(`   Location: ${locationDetails}`);
          }
        } else {
          console.log(`   ⚠️ User không tìm thấy trong candidate users`);
        }
        console.log();
      }

      // Show users cùng location nhưng không có trong recommendations
      console.log("---");
      console.log(
        "📊 Users cùng location nhưng không có trong recommendations:"
      );
      const sameLocationUsers = candidateUsers.filter((u) => {
        if (!currentUser.provinceCode || !u.provinceCode) return false;
        if (u.provinceCode !== currentUser.provinceCode) return false;
        return !recommendations.some((r) => r.id === u.id);
      });

      if (sameLocationUsers.length > 0) {
        sameLocationUsers.forEach((u) => {
          console.log(`   - ${u.displayName} (@${u.username})`);
          console.log(
            `     Location: ${u.provinceCode} / ${u.districtCode || "N/A"} / ${u.wardCode || "N/A"}`
          );
        });
      } else {
        console.log("   (Không có)");
      }
    }

    console.log("=".repeat(60));
    console.log("✅ Test completed!");
    console.log("=".repeat(60));
  } catch (error) {
    console.error("❌ Error:", error);
    if (error instanceof Error) {
      console.error("   Message:", error.message);
    }
  } finally {
    await prisma.$disconnect();
  }
}

// Lấy userId từ command line arguments
const userId = process.argv[2];

testAIWithLocation(userId);
