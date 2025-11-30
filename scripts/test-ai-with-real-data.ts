/**
 * Test AI Recommendations API với data thật từ database
 * Chạy: tsx scripts/test-ai-with-real-data.ts [userId]
 */

import { PrismaClient } from "@prisma/client";
import { recommendFriends } from "../src/lib/ai-api";

const prisma = new PrismaClient();

async function testWithRealData(userId?: string) {
  try {
    console.log("=".repeat(60));
    console.log("🧪 Testing AI Recommendations với Real Database Data");
    console.log("=".repeat(60));
    console.log();

    // Lấy user để test (hoặc dùng userId được truyền vào)
    let targetUser;
    if (userId) {
      targetUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, username: true, displayName: true },
      });
      if (!targetUser) {
        console.log(`❌ Không tìm thấy user với ID: ${userId}`);
        return;
      }
    } else {
      // Lấy user đầu tiên có posts
      targetUser = await prisma.user.findFirst({
        where: {
          posts: { some: { privacy: "PUBLIC" } },
        },
        select: { id: true, username: true, displayName: true },
        orderBy: { createdAt: "desc" },
      });

      if (!targetUser) {
        console.log("❌ Không tìm thấy user nào có posts trong database!");
        console.log("   Hãy tạo posts trước hoặc seed database.");
        return;
      }
    }

    console.log(
      `🎯 Target User: ${targetUser.displayName} (@${targetUser.username})`
    );
    console.log(`   ID: ${targetUser.id}`);
    console.log();

    // Fetch data của target user
    console.log("📊 Fetching target user data...");
    const currentUser = await prisma.user.findUnique({
      where: { id: targetUser.id },
      select: {
        id: true,
        username: true,
        displayName: true,
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

    console.log(`   Posts: ${currentUser.posts.length}`);
    console.log(`   Liked posts: ${currentUser.likes.length}`);
    console.log(`   Comments: ${currentUser.comments.length}`);
    console.log(`   Following: ${currentUser.following.length}`);
    console.log();

    // Fetch candidate users
    console.log("📊 Fetching candidate users...");
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
      take: 50, // Limit để tránh quá tải
    });

    console.log(`   Found ${candidateUsers.length} candidate users`);
    console.log();

    if (candidateUsers.length === 0) {
      console.log("⚠️  Không có candidate users để recommend!");
      console.log("   Cần có users khác có posts trong database.");
      return;
    }

    // Format data để gửi cho Python API
    console.log("🔄 Formatting data for Python API...");
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
      },
      ...candidateUsers.map((u) => ({
        id: u.id,
        username: u.username,
        displayName: u.displayName,
        post_contents: u.posts.map((p) => p.content),
        liked_post_contents: u.likes.map((l) => l.post.content).filter(Boolean),
        comment_contents: u.comments.map((c) => c.content),
        following_ids: u.following.map((f) => f.followingId),
      })),
    ];

    console.log(`   Total users data: ${usersData.length}`);
    console.log();

    // Gọi Python AI API
    console.log("🤖 Calling Python AI API...");
    console.log("   (Có thể mất 30-60 giây để xử lý embeddings...)");
    console.log();

    const startTime = Date.now();
    const recommendations = await recommendFriends(targetUser.id, usersData);
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log(`✅ AI API response sau ${duration}s`);
    console.log();

    // Hiển thị kết quả
    if (recommendations.length === 0) {
      console.log(
        "⚠️  Không có recommendations nào (threshold quá cao hoặc không có users tương tự)"
      );
    } else {
      console.log(`🎉 Found ${recommendations.length} recommendations:`);
      console.log();
      recommendations.forEach((rec, index) => {
        const user = candidateUsers.find((u) => u.id === rec.id);
        console.log(`${index + 1}. ${rec.displayName} (@${rec.username})`);
        console.log(`   Similarity: ${rec.similarity.toFixed(4)}`);
        if (user) {
          console.log(`   Posts: ${user.posts.length}`);
        }
        console.log();
      });
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

testWithRealData(userId);
