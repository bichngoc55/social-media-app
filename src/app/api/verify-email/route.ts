import { lucia } from "@/auth";
import prisma from "@/lib/prisma";
import { sendWelcomeEmail } from "@/lib/email";
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
      return NextResponse.json({ 
        error: "Invalid or expired OTP" 
      }, { status: 400 });
    }

    // Kiểm tra xem email đã được xác thực chưa
    if (verification.user.emailVerified) {
      return NextResponse.json({ 
        error: "Email already verified" 
      }, { status: 400 });
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
    cookies().set(sessionCookie.name, sessionCookie.value, sessionCookie.attributes);
    console.log("Session created successfully");

    return NextResponse.json({ 
      success: true, 
      message: "Email verified successfully" 
    });

  } catch (error) {
    console.error("Error verifying email:", error);
    return NextResponse.json({ 
      error: "Internal server error" 
    }, { status: 500 });
  }
}
