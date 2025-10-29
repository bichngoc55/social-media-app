import prisma from "@/lib/prisma";
import { generateOTP, sendOTPEmail } from "@/lib/email";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    // Tìm user theo email
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: {
        id: true,
        email: true,
        emailVerified: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Kiểm tra xem email đã được xác thực chưa
    if (user.emailVerified) {
      return NextResponse.json(
        {
          error: "Email already verified",
        },
        { status: 400 }
      );
    }

    // Tạo OTP mới
    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 phút

    // Lưu OTP vào database
    await prisma.emailVerification.create({
      data: {
        userId: user.id,
        email: email.toLowerCase(),
        otp,
        expiresAt,
      },
    });

    // Gửi email OTP
    const emailResult = await sendOTPEmail(email, otp);

    if (!emailResult.success) {
      return NextResponse.json(
        {
          error: "Failed to send OTP email",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "OTP sent successfully",
    });
  } catch (error) {
    console.error("Error sending OTP:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
      },
      { status: 500 }
    );
  }
}
