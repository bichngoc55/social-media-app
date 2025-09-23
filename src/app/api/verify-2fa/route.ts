import { lucia } from "@/auth";
import prisma from "@/lib/prisma";
import { getDeviceInfo } from "@/lib/device";
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function POST(request: NextRequest) {
  try {
    const { email, otp } = await request.json();

    if (!email || !otp) {
      return NextResponse.json({ 
        error: "Email and OTP are required" 
      }, { status: 400 });
    }

    // Lấy thông tin thiết bị
    const deviceInfo = await getDeviceInfo();

    // Tìm verification record
    const verification = await prisma.twoFactorAuth.findFirst({
      where: {
        email: email.toLowerCase(),
        otp,
        deviceId: deviceInfo.deviceId,
        used: false,
        expiresAt: {
          gt: new Date(), // Chưa hết hạn
        },
      },
      include: {
        user: {
          select: {
            id: true,
            displayName: true,
          },
        },
      },
    });

    if (!verification) {
      return NextResponse.json({ 
        error: "Invalid or expired OTP" 
      }, { status: 400 });
    }

    // Đánh dấu OTP đã sử dụng
    await prisma.twoFactorAuth.update({
      where: { id: verification.id },
      data: { used: true },
    });

    // Tạo hoặc cập nhật device session
    await prisma.deviceSession.upsert({
      where: {
        userId_deviceId: {
          userId: verification.user.id,
          deviceId: deviceInfo.deviceId,
        },
      },
      update: {
        lastUsedAt: new Date(),
        isTrusted: true,
      },
      create: {
        userId: verification.user.id,
        deviceId: deviceInfo.deviceId,
        deviceName: deviceInfo.deviceName,
        userAgent: deviceInfo.userAgent,
        ipAddress: deviceInfo.ipAddress,
        isTrusted: true,
      },
    });

    // Xóa các OTP cũ của user này
    await prisma.twoFactorAuth.deleteMany({
      where: {
        userId: verification.user.id,
        used: true,
      },
    });

    // Tạo session cho user
    const session = await lucia.createSession(verification.user.id, {});
    const sessionCookie = lucia.createSessionCookie(session.id);
    cookies().set(sessionCookie.name, sessionCookie.value, sessionCookie.attributes);

    return NextResponse.json({ 
      success: true, 
      message: "2FA verified successfully",
      deviceName: deviceInfo.deviceName,
    });

  } catch (error) {
    console.error("Error verifying 2FA:", error);
    return NextResponse.json({ 
      error: "Internal server error" 
    }, { status: 500 });
  }
}
