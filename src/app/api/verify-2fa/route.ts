import { lucia } from "@/auth";
import prisma from "@/lib/prisma";
import { generateDeviceId, getDeviceName } from "@/lib/device";
import { NextRequest, NextResponse } from "next/server";
import { cookies, headers } from "next/headers";

export async function POST(request: NextRequest) {
  try {
    const { email, otp, deviceInfo: clientDeviceInfo } = await request.json();

    if (!email || !otp) {
      return NextResponse.json(
        {
          error: "Email and OTP are required",
        },
        { status: 400 }
      );
    }

    // Sử dụng device info từ client nếu có, nếu không thì tạo mới từ headers
    const deviceInfo =
      clientDeviceInfo ||
      (() => {
        const headersList = headers();
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
    console.log("2FA Verify - Device Info:", deviceInfo);

    // Tìm verification record
    console.log("Looking for 2FA record with:", {
      email: email.toLowerCase(),
      otp,
      deviceId: deviceInfo.deviceId,
    });

    // Tìm OTP record - thử với deviceId trước, nếu không có thì tìm theo email + OTP
    let verification = await prisma.twoFactorAuth.findFirst({
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

    // Nếu không tìm thấy với deviceId, thử tìm theo email + OTP (fallback)
    if (!verification) {
      console.log("Not found with deviceId, trying fallback...");
      verification = await prisma.twoFactorAuth.findFirst({
        where: {
          email: email.toLowerCase(),
          otp,
          used: false,
          expiresAt: {
            gt: new Date(),
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
    }

    console.log("Found verification record:", verification);

    if (!verification) {
      return NextResponse.json(
        {
          error: "Invalid or expired OTP",
        },
        { status: 400 }
      );
    }

    // Nếu tìm thấy record nhưng deviceId khác, cập nhật deviceId
    if (verification.deviceId !== deviceInfo.deviceId) {
      console.log(
        "Updating deviceId from",
        verification.deviceId,
        "to",
        deviceInfo.deviceId
      );
      await prisma.twoFactorAuth.update({
        where: { id: verification.id },
        data: { deviceId: deviceInfo.deviceId },
      });
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
    cookies().set(
      sessionCookie.name,
      sessionCookie.value,
      sessionCookie.attributes
    );

    return NextResponse.json({
      success: true,
      message: "2FA verified successfully",
      deviceName: deviceInfo.deviceName,
    });
  } catch (error) {
    console.error("Error verifying 2FA:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
      },
      { status: 500 }
    );
  }
}
