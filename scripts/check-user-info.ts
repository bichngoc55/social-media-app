/**
 * Kiểm tra thông tin user và reset mật khẩu nếu cần
 * Chạy: tsx scripts/check-user-info.ts [userId] [newPassword]
 */

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function checkUserInfo(userId: string, newPassword?: string) {
  try {
    console.log("=".repeat(60));
    console.log("🔍 Checking User Information");
    console.log("=".repeat(60));
    console.log();

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        displayName: true,
        email: true,
        emailVerified: true,
        createdAt: true,
        passwordHash: true,
        googleId: true,
        role: true,
        _count: {
          select: {
            posts: true,
            followers: true,
            following: true,
            likes: true,
            comments: true,
          },
        },
      },
    });

    if (!user) {
      console.log(`❌ Không tìm thấy user với ID: ${userId}`);
      return;
    }

    console.log("📋 User Information:");
    console.log(`   ID: ${user.id}`);
    console.log(`   Username: ${user.username}`);
    console.log(`   Display Name: ${user.displayName}`);
    console.log(`   Email: ${user.email || "N/A"}`);
    console.log(`   Email Verified: ${user.emailVerified ? "✅" : "❌"}`);
    console.log(`   Role: ${user.role}`);
    console.log(`   Created: ${user.createdAt.toISOString()}`);
    console.log(`   Google ID: ${user.googleId || "N/A"}`);
    console.log();

    console.log("📊 Statistics:");
    console.log(`   Posts: ${user._count.posts}`);
    console.log(`   Followers: ${user._count.followers}`);
    console.log(`   Following: ${user._count.following}`);
    console.log(`   Likes: ${user._count.likes}`);
    console.log(`   Comments: ${user._count.comments}`);
    console.log();

    if (user.passwordHash) {
      console.log("🔐 Password Status: ✅ Has password (hashed)");
      console.log("   ⚠️  Mật khẩu được hash bằng bcrypt, không thể đọc lại");

      // Nếu account được tạo từ seed script, có thể mật khẩu là "password123"
      console.log("   💡 Nếu account được tạo từ seed script:");
      console.log("      Mật khẩu mặc định có thể là: password123");
    } else if (user.googleId) {
      console.log("🔐 Password Status: ❌ No password (Google OAuth account)");
      console.log("   Account này đăng nhập bằng Google, không có mật khẩu");
    } else {
      console.log("🔐 Password Status: ❌ No password");
    }
    console.log();

    // Reset password nếu có newPassword
    if (newPassword) {
      console.log("🔄 Resetting password...");
      const passwordHash = await bcrypt.hash(newPassword, 12);

      await prisma.user.update({
        where: { id: userId },
        data: { passwordHash },
      });

      console.log(`✅ Mật khẩu đã được reset thành công!`);
      console.log(`   Username: ${user.username}`);
      console.log(`   New Password: ${newPassword}`);
      console.log();
    } else {
      console.log("💡 Để reset mật khẩu, chạy:");
      console.log(`   tsx scripts/check-user-info.ts ${userId} <newPassword>`);
      console.log();
    }

    console.log("=".repeat(60));
  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

// Lấy arguments từ command line
const userId = process.argv[2];
const newPassword = process.argv[3];

if (!userId) {
  console.log("❌ Vui lòng cung cấp User ID");
  console.log(
    "   Usage: tsx scripts/check-user-info.ts <userId> [newPassword]"
  );
  process.exit(1);
}

checkUserInfo(userId, newPassword);
