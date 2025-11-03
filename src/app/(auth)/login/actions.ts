"use server";

import { lucia } from "@/auth";
import prisma from "@/lib/prisma";
import { loginSchema, LoginValues } from "@/lib/validation";
import { generateDeviceId, getDeviceName } from "@/lib/device";
import bcrypt from "bcryptjs";
import { isRedirectError } from "next/dist/client/components/redirect";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

export async function login(
  credentials: LoginValues
): Promise<{ error: string }> {
  try {
    const { username, password } = loginSchema.parse(credentials);

    const existingUser = await prisma.user.findFirst({
      where: {
        username: {
          equals: username,
          mode: "insensitive",
        },
      },
      select: {
        id: true,
        username: true,
        displayName: true,
        avatarUrl: true,
        googleId: true,
        passwordHash: true,
        emailVerified: true,
        email: true,
        role: true, // Thêm role để check admin
      },
    });

    if (!existingUser || !existingUser.passwordHash) {
      return {
        error: "Incorrect username or password",
      };
    }

    const validPassword = await bcrypt.compare(
      password,
      existingUser.passwordHash
    );

    if (!validPassword) {
      return {
        error: "Incorrect username or password",
      };
    }

    // Kiểm tra email đã được xác thực chưa
    if (!existingUser.emailVerified) {
      return {
        error:
          "Vui lòng xác thực email trước khi đăng nhập. Kiểm tra hộp thư của bạn để lấy mã xác thực.",
      };
    }

    // Lấy thông tin thiết bị từ headers
    const headersList = await headers();
    const userAgent = headersList.get("user-agent") || "Unknown";
    const ipAddress =
      headersList.get("x-forwarded-for") ||
      headersList.get("x-real-ip") ||
      "unknown";

    const deviceInfo = {
      deviceId: generateDeviceId(userAgent),
      deviceName: getDeviceName(userAgent),
      userAgent,
      ipAddress: ipAddress === "unknown" ? undefined : ipAddress,
    };

    // Kiểm tra xem thiết bị đã được tin tưởng chưa
    let trustedDevice = await prisma.deviceSession.findUnique({
      where: {
        userId_deviceId: {
          userId: existingUser.id,
          deviceId: deviceInfo.deviceId,
        },
      },
    });

    // Nếu chưa có deviceSession, tạo mới (chưa tin tưởng)
    if (!trustedDevice) {
      trustedDevice = await prisma.deviceSession.create({
        data: {
          userId: existingUser.id,
          deviceId: deviceInfo.deviceId,
          deviceName: deviceInfo.deviceName,
          userAgent: deviceInfo.userAgent,
          ipAddress: deviceInfo.ipAddress,
          isTrusted: false, // Chưa tin tưởng
        },
      });
    }

    // Nếu thiết bị chưa được tin tưởng, yêu cầu 2FA
    if (!trustedDevice.isTrusted) {
      // Gửi 2FA email với device info
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_BASE_URL}/api/send-2fa`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Device-Info": JSON.stringify(deviceInfo),
          },
          body: JSON.stringify({
            email: existingUser.email,
            deviceInfo: deviceInfo,
          }),
        }
      );

      if (!response.ok) {
        return {
          error: "Không thể gửi mã xác thực. Vui lòng thử lại.",
        };
      }

      // Redirect đến trang 2FA
      return redirect(
        `/verify-2fa?email=${encodeURIComponent(existingUser.email!)}&device=${encodeURIComponent(deviceInfo.deviceName)}`
      );
    }

    // Cập nhật lastUsedAt cho thiết bị tin tưởng
    await prisma.deviceSession.update({
      where: {
        userId_deviceId: {
          userId: existingUser.id,
          deviceId: deviceInfo.deviceId,
        },
      },
      data: {
        lastUsedAt: new Date(),
      },
    });

    const session = await lucia.createSession(existingUser.id, {});
    const sessionCookie = lucia.createSessionCookie(session.id);
    cookies().set(
      sessionCookie.name,
      sessionCookie.value,
      sessionCookie.attributes
    );

    // Redirect admin to dashboard, others to home
    if (existingUser.role === "ADMIN") {
      return redirect("/admin/dashboard");
    }

    return redirect("/");
  } catch (error) {
    if (isRedirectError(error)) throw error;
    console.error(error);
    return {
      error: "Something went wrong. Please try again.",
    };
  }
}
