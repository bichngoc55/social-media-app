"use server";

import { lucia } from "@/auth";
import prisma from "@/lib/prisma";
import { sendWelcomeEmail } from "@/lib/email";
import { verifyEmailSchema, VerifyEmailValues } from "@/lib/validation";
import { isRedirectError } from "next/navigation";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export async function verifyEmailAction(data: VerifyEmailValues) {
  try {
    // Validate input
    const validatedData = verifyEmailSchema.parse(data);
    const { email, otp } = validatedData;

    // Tìm verification record
    const verification = await prisma.emailVerification.findFirst({
      where: {
        email: email.toLowerCase(),
        otp,
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
            emailVerified: true,
          },
        },
      },
    });

    if (!verification) {
      return {
        success: false,
        error: "Mã OTP không hợp lệ hoặc đã hết hạn",
      };
    }

    // Kiểm tra xem email đã được xác thực chưa
    if (verification.user.emailVerified) {
      return {
        success: false,
        error: "Email đã được xác thực rồi",
      };
    }

    // Cập nhật user và đánh dấu OTP đã sử dụng
    await prisma.$transaction(async (tx) => {
      // Cập nhật user
      await tx.user.update({
        where: { id: verification.user.id },
        data: { emailVerified: true },
      });

      // Đánh dấu OTP đã sử dụng
      await tx.emailVerification.update({
        where: { id: verification.id },
        data: { used: true },
      });

      // Xóa các OTP cũ của user này
      await tx.emailVerification.deleteMany({
        where: {
          userId: verification.user.id,
          used: true,
        },
      });
    });

    // Gửi email chào mừng
    await sendWelcomeEmail(email, verification.user.displayName);

    // Tạo session cho user sau khi xác thực email thành công
    console.log("Creating session for user:", verification.user.id);
    const session = await lucia.createSession(verification.user.id, {});
    const sessionCookie = lucia.createSessionCookie(session.id);
    (await cookies()).set(
      sessionCookie.name,
      sessionCookie.value,
      sessionCookie.attributes
    );
    console.log("Session created successfully");

    return { success: true, message: "Email verified successfully" };
  } catch (error) {
    // Redirect errors are automatically handled by Next.js
    console.error("Error verifying email:", error);
    return {
      success: false,
      error: "Có lỗi xảy ra, vui lòng thử lại",
    };
  }
}
