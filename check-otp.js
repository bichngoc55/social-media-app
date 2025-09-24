const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkOTP() {
  try {
    console.log('🔍 Kiểm tra OTP records...');
    
    // Tìm user
    const user = await prisma.user.findUnique({
      where: { email: 'loppy7934@gmail.com' },
      select: { id: true, email: true, displayName: true }
    });
    
    if (!user) {
      console.log('❌ User không tồn tại');
      return;
    }
    
    console.log('👤 User:', user);
    
    // Tìm tất cả OTP records của user này
    const otpRecords = await prisma.twoFactorAuth.findMany({
      where: { userId: user.id },
      orderBy: { id: 'desc' }
    });
    
    console.log('📧 Tất cả OTP records:', otpRecords);
    
    // Tìm OTP record cụ thể với OTP 816702
    const specificOTP816702 = await prisma.twoFactorAuth.findFirst({
      where: {
        email: 'loppy7934@gmail.com',
        otp: '816702',
        deviceId: 'e0b45a9743e8b4ff'
      }
    });
    
    console.log('🎯 OTP record với 816702:', specificOTP816702);
    
    // Tìm OTP record cụ thể với OTP 933147
    const specificOTP933147 = await prisma.twoFactorAuth.findFirst({
      where: {
        email: 'loppy7934@gmail.com',
        otp: '933147',
        deviceId: 'e0b45a9743e8b4ff'
      }
    });
    
    console.log('🎯 OTP record với 933147:', specificOTP933147);
    
    // Tìm tất cả OTP records với deviceId này
    const allOTPsForDevice = await prisma.twoFactorAuth.findMany({
      where: {
        email: 'loppy7934@gmail.com',
        deviceId: 'e0b45a9743e8b4ff'
      }
    });
    
    console.log('📱 Tất cả OTP records cho device này:', allOTPsForDevice);
    
    // Kiểm tra device session
    const deviceSession = await prisma.deviceSession.findUnique({
      where: {
        userId_deviceId: {
          userId: user.id,
          deviceId: 'e0b45a9743e8b4ff'
        }
      }
    });
    
    console.log('📱 Device session:', deviceSession);
    
  } catch (error) {
    console.error('❌ Lỗi:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkOTP();
