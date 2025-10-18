const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function resetDeviceSession() {
  try {
    console.log('🔄 Reset device session...');
    
    // Xóa device session
    const deleted = await prisma.deviceSession.deleteMany({
      where: {
        userId: 'lqp3l3tn2a4qmm7o',
        deviceId: 'e0b45a9743e8b4ff'
      }
    });
    
    console.log('✅ Đã xóa device session:', deleted.count);
    
    // Xóa tất cả OTP records cũ
    const deletedOTPs = await prisma.twoFactorAuth.deleteMany({
      where: {
        userId: 'lqp3l3tn2a4qmm7o'
      }
    });
    
    console.log('✅ Đã xóa OTP records cũ:', deletedOTPs.count);
    
  } catch (error) {
    console.error('❌ Lỗi:', error);
  } finally {
    await prisma.$disconnect();
  }
}

resetDeviceSession();
