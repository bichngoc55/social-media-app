import prisma from "@/lib/prisma";
import { generateOTP, send2FAEmail } from "@/lib/email";
import { generateDeviceId, getDeviceName } from "@/lib/device";
import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";

export async function POST(request: NextRequest) {
  try {
    const { email, deviceInfo: clientDeviceInfo } = await request.json();

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    // Sử dụng device info từ client nếu có, nếu không thì tạo mới từ headers
    const deviceInfo =
      clientDeviceInfo ||
      (async () => {
        const headersList = await headers(); // Add 'await' here
        const userAgent = headersList.get("user-agent") || "Unknown";
        const ipAddress =
          headersList.get("x-forwarded-for") ||
          headersList.get("x-real-ip") ||
          undefined;
        return {
          deviceId: generateDeviceId(userAgent),
          deviceName: getDeviceName(userAgent),
          userAgent,
          ipAddress,
        };
      })();
    console.log("2FA Send - Device Info:", deviceInfo);

    // Tìm user theo email
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: {
        id: true,
        email: true,
        displayName: true,
        emailVerified: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (!user.emailVerified) {
      return NextResponse.json(
        {
          error: "Please verify your email first",
        },
        { status: 400 }
      );
    }

    // Kiểm tra xem thiết bị đã được tin tưởng chưa
    const trustedDevice = await prisma.deviceSession.findUnique({
      where: {
        userId_deviceId: {
          userId: user.id,
          deviceId: deviceInfo.deviceId,
        },
      },
    });

    if (trustedDevice?.isTrusted) {
      return NextResponse.json(
        {
          error: "This device is already trusted",
        },
        { status: 400 }
      );
    }

    // Xóa TẤT CẢ OTP cũ của user này (không chỉ theo deviceId)
    await prisma.twoFactorAuth.deleteMany({
      where: {
        userId: user.id,
      },
    });

    // Tạo OTP mới
    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 phút

    // Lưu OTP vào database
    await prisma.twoFactorAuth.create({
      data: {
        userId: user.id,
        email: email.toLowerCase(),
        otp,
        deviceId: deviceInfo.deviceId,
        expiresAt,
      },
    });

    // Gửi email 2FA
    const emailResult = await send2FAEmail(
      email,
      user.displayName,
      otp,
      deviceInfo.deviceName,
      deviceInfo.ipAddress
    );

    if (!emailResult.success) {
      return NextResponse.json(
        {
          error: "Failed to send 2FA email",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "2FA code sent successfully",
      deviceName: deviceInfo.deviceName,
    });
  } catch (error) {
    console.error("Error sending 2FA:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
      },
      { status: 500 }
    );
  }
}
