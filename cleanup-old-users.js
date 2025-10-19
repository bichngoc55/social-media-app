const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function cleanupOldUsers() {
  try {
    console.log("🧹 Bắt đầu dọn dẹp users cũ...");

    // Lấy 2 users mới nhất
    const latestUsers = await prisma.user.findMany({
      select: { id: true },
      orderBy: { createdAt: "desc" },
      take: 2,
    });

    const keepUserIds = latestUsers.map((u) => u.id);
    console.log(`📌 Giữ lại 2 users mới nhất: ${keepUserIds.join(", ")}`);

    // Lấy tất cả users cũ
    const oldUsers = await prisma.user.findMany({
      where: {
        id: { notIn: keepUserIds },
      },
      select: {
        id: true,
        username: true,
        email: true,
        displayName: true,
        createdAt: true,
      },
      orderBy: { createdAt: "asc" },
    });

    console.log(`📊 Tìm thấy ${oldUsers.length} users cũ cần xóa:`);
    oldUsers.forEach((user, index) => {
      console.log(
        `${index + 1}. ${user.username} (${user.email}) - ${user.createdAt.toISOString()}`
      );
    });

    if (oldUsers.length === 0) {
      console.log("ℹ️ Không có user cũ nào để xóa.");
      return;
    }

    // Xóa từng user cũ với transaction
    for (const user of oldUsers) {
      console.log(`\n🗑️ Đang xóa user: ${user.username}...`);

      await prisma.$transaction(async (tx) => {
        // Xóa tất cả dữ liệu liên quan
        await tx.like.deleteMany({ where: { userId: user.id } });
        await tx.comment.deleteMany({ where: { userId: user.id } });
        await tx.bookmark.deleteMany({ where: { userId: user.id } });
        await tx.follow.deleteMany({
          where: {
            OR: [{ followerId: user.id }, { followingId: user.id }],
          },
        });
        await tx.post.deleteMany({ where: { userId: user.id } });
        await tx.emailVerification.deleteMany({ where: { userId: user.id } });
        await tx.deviceSession.deleteMany({ where: { userId: user.id } });
        await tx.twoFactorAuth.deleteMany({ where: { userId: user.id } });

        // Xóa user
        await tx.user.delete({ where: { id: user.id } });
      });

      console.log(`✅ Đã xóa user: ${user.username}`);
    }

    console.log(`\n🎉 Hoàn thành! Đã xóa ${oldUsers.length} users cũ.`);
  } catch (error) {
    console.error("❌ Lỗi khi dọn dẹp users:", error);
  } finally {
    await prisma.$disconnect();
  }
}

cleanupOldUsers();
