const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function safeDeleteUser() {
  try {
    console.log("👥 Danh sách users hiện tại:");

    const users = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        email: true,
        displayName: true,
        createdAt: true,
        _count: {
          select: {
            posts: true,
            followers: true,
            following: true,
            bookmarks: true,
            comments: true,
            likes: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    users.forEach((user, index) => {
      console.log(`${index + 1}. ID: ${user.id}`);
      console.log(`   Username: ${user.username}`);
      console.log(`   Email: ${user.email}`);
      console.log(`   Display Name: ${user.displayName}`);
      console.log(`   Created: ${user.createdAt.toISOString()}`);
      console.log(
        `   Posts: ${user._count.posts}, Followers: ${user._count.followers}, Following: ${user._count.following}`
      );
      console.log(
        `   Bookmarks: ${user._count.bookmarks}, Comments: ${user._count.comments}, Likes: ${user._count.likes}`
      );
      console.log("---");
    });

    // Thay đổi ID này để xóa user cụ thể
    const userIdToDelete = "3oadg4i2f5wldpsr"; // Thay đổi ID này

    console.log(`\n🗑️ Sẽ xóa user có ID: ${userIdToDelete}`);

    // Kiểm tra user có tồn tại không
    const userToDelete = await prisma.user.findUnique({
      where: { id: userIdToDelete },
      select: {
        id: true,
        username: true,
        email: true,
        displayName: true,
      },
    });

    if (!userToDelete) {
      console.log("❌ Không tìm thấy user với ID này!");
      return;
    }

    console.log(`📋 Thông tin user sẽ bị xóa:`);
    console.log(`   Username: ${userToDelete.username}`);
    console.log(`   Email: ${userToDelete.email}`);
    console.log(`   Display Name: ${userToDelete.displayName}`);

    // Xóa user với transaction để đảm bảo an toàn
    await prisma.$transaction(async (tx) => {
      // Xóa tất cả dữ liệu liên quan trước
      await tx.like.deleteMany({ where: { userId: userIdToDelete } });
      await tx.comment.deleteMany({ where: { userId: userIdToDelete } });
      await tx.bookmark.deleteMany({ where: { userId: userIdToDelete } });
      await tx.follow.deleteMany({
        where: {
          OR: [{ followerId: userIdToDelete }, { followingId: userIdToDelete }],
        },
      });
      await tx.post.deleteMany({ where: { userId: userIdToDelete } });
      await tx.emailVerification.deleteMany({
        where: { userId: userIdToDelete },
      });
      await tx.deviceSession.deleteMany({ where: { userId: userIdToDelete } });
      await tx.twoFactorAuth.deleteMany({ where: { userId: userIdToDelete } });

      // Cuối cùng xóa user
      await tx.user.delete({
        where: { id: userIdToDelete },
      });
    });

    console.log(`\n✅ Đã xóa thành công user: ${userToDelete.username}`);
  } catch (error) {
    console.error("❌ Lỗi khi xóa user:", error);
  } finally {
    await prisma.$disconnect();
  }
}

safeDeleteUser();
