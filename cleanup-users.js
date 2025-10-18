const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function cleanupUsers() {
  try {
    console.log('🧹 Bắt đầu dọn dẹp users...');
    
    // Xem tất cả users hiện tại
    const allUsers = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        email: true,
        displayName: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' }
    });
    
    console.log(`📊 Tổng số users: ${allUsers.length}`);
    console.log('👥 Danh sách users:');
    allUsers.forEach((user, index) => {
      console.log(`${index + 1}. ${user.username} (${user.email}) - ${user.displayName} - ${user.createdAt.toISOString()}`);
    });
    
    // Xóa users cũ (giữ lại 2 users mới nhất)
    if (allUsers.length > 2) {
      const usersToDelete = allUsers.slice(2); // Bỏ qua 2 users mới nhất
      
      console.log(`\n🗑️ Sẽ xóa ${usersToDelete.length} users cũ:`);
      usersToDelete.forEach((user, index) => {
        console.log(`${index + 1}. ${user.username} (${user.email})`);
      });
      
      // Xóa từng user (cascade sẽ xóa các bảng liên quan)
      for (const user of usersToDelete) {
        await prisma.user.delete({
          where: { id: user.id }
        });
        console.log(`✅ Đã xóa user: ${user.username}`);
      }
      
      console.log(`\n🎉 Hoàn thành! Đã xóa ${usersToDelete.length} users.`);
    } else {
      console.log('ℹ️ Không cần xóa user nào (chỉ có 2 users hoặc ít hơn).');
    }
    
  } catch (error) {
    console.error('❌ Lỗi khi dọn dẹp users:', error);
  } finally {
    await prisma.$disconnect();
  }
}

cleanupUsers();
