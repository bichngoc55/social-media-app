const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function simpleDeleteUser() {
  try {
    console.log('👥 Danh sách users hiện tại:');
    
    const users = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        email: true,
        displayName: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' }
    });
    
    users.forEach((user, index) => {
      console.log(`${index + 1}. ID: ${user.id}`);
      console.log(`   Username: ${user.username}`);
      console.log(`   Email: ${user.email}`);
      console.log(`   Display Name: ${user.displayName}`);
      console.log(`   Created: ${user.createdAt.toISOString()}`);
      console.log('---');
    });
    
    // Thay đổi ID này để xóa user cụ thể
    const userIdToDelete = '3oadg4i2f5wldpsr'; // Thay đổi ID này
    
    console.log(`\n🗑️ Sẽ xóa user có ID: ${userIdToDelete}`);
    
    // Kiểm tra user có tồn tại không
    const userToDelete = await prisma.user.findUnique({
      where: { id: userIdToDelete },
      select: {
        id: true,
        username: true,
        email: true,
        displayName: true,
      }
    });
    
    if (!userToDelete) {
      console.log('❌ Không tìm thấy user với ID này!');
      return;
    }
    
    console.log(`📋 Thông tin user sẽ bị xóa:`);
    console.log(`   Username: ${userToDelete.username}`);
    console.log(`   Email: ${userToDelete.email}`);
    console.log(`   Display Name: ${userToDelete.displayName}`);
    
    // Xóa user trực tiếp (cascade delete sẽ xử lý)
    await prisma.user.delete({
      where: { id: userIdToDelete }
    });
    
    console.log(`\n✅ Đã xóa thành công user: ${userToDelete.username}`);
    
  } catch (error) {
    console.error('❌ Lỗi khi xóa user:', error);
    
    // Nếu lỗi cascade, thử xóa từng bảng một
    if (error.message.includes('cascade') || error.message.includes('foreign key')) {
      console.log('\n🔄 Thử xóa từng bảng một...');
      
      try {
        const userIdToDelete = '3oadg4i2f5wldpsr';
        
        // Xóa từng bảng một cách tuần tự
        console.log('1. Xóa likes...');
        await prisma.like.deleteMany({ where: { userId: userIdToDelete } });
        
        console.log('2. Xóa comments...');
        await prisma.comment.deleteMany({ where: { userId: userIdToDelete } });
        
        console.log('3. Xóa bookmarks...');
        await prisma.bookmark.deleteMany({ where: { userId: userIdToDelete } });
        
        console.log('4. Xóa follows...');
        await prisma.follow.deleteMany({ 
          where: { 
            OR: [
              { followerId: userIdToDelete },
              { followingId: userIdToDelete }
            ]
          } 
        });
        
        console.log('5. Xóa posts...');
        await prisma.post.deleteMany({ where: { userId: userIdToDelete } });
        
        console.log('6. Xóa email verifications...');
        await prisma.emailVerification.deleteMany({ where: { userId: userIdToDelete } });
        
        console.log('7. Xóa device sessions...');
        await prisma.deviceSession.deleteMany({ where: { userId: userIdToDelete } });
        
        console.log('8. Xóa two factor auths...');
        await prisma.twoFactorAuth.deleteMany({ where: { userId: userIdToDelete } });
        
        console.log('9. Xóa user...');
        await prisma.user.delete({ where: { id: userIdToDelete } });
        
        console.log('✅ Đã xóa thành công user!');
        
      } catch (secondError) {
        console.error('❌ Vẫn lỗi khi xóa từng bảng:', secondError);
      }
    }
  } finally {
    await prisma.$disconnect();
  }
}

simpleDeleteUser();
