const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function clearAllData() {
  try {
    console.log("🧹 Bắt đầu xóa hết tất cả dữ liệu...");

    // Xóa tất cả dữ liệu theo thứ tự (từ bảng con đến bảng cha)
    console.log("1. Xóa likes...");
    await prisma.like.deleteMany({});

    console.log("2. Xóa comments...");
    await prisma.comment.deleteMany({});

    console.log("3. Xóa bookmarks...");
    await prisma.bookmark.deleteMany({});

    console.log("4. Xóa follows...");
    await prisma.follow.deleteMany({});

    console.log("5. Xóa posts...");
    await prisma.post.deleteMany({});

    console.log("6. Xóa email verifications...");
    await prisma.emailVerification.deleteMany({});

    console.log("7. Xóa device sessions...");
    await prisma.deviceSession.deleteMany({});

    console.log("8. Xóa two factor auths...");
    await prisma.twoFactorAuth.deleteMany({});

    console.log("9. Xóa users...");
    await prisma.user.deleteMany({});

    console.log("10. Xóa sessions...");
    await prisma.session.deleteMany({});

    console.log("11. Xóa accounts...");
    await prisma.account.deleteMany({});

    console.log("12. Xóa verification tokens...");
    await prisma.verificationToken.deleteMany({});

    console.log("\n🎉 Đã xóa hết tất cả dữ liệu thành công!");
    console.log("📊 Database hiện tại đã trống.");
  } catch (error) {
    console.error("❌ Lỗi khi xóa dữ liệu:", error);
  } finally {
    await prisma.$disconnect();
  }
}

clearAllData();
