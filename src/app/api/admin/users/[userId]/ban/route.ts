import { requireAdmin } from "@/lib/admin";
import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const admin = await requireAdmin();
    const { userId } = await params;

    // Get user to ban
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        displayName: true,
        username: true,
        status: true,
      } as any,
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Check if user is already banned
    const userWithStatus = user as any;
    if (userWithStatus.status === false) {
      return NextResponse.json(
        { error: "User is already banned" },
        { status: 400 }
      );
    }

    // Update user status to false (banned)
    await prisma.user.update({
      where: { id: userId },
      data: {
        status: false,
      } as any,
    });

    // Get admin info for notification
    const adminInfo = await prisma.user.findUnique({
      where: { id: admin.id },
      select: {
        id: true,
        username: true,
        displayName: true,
        avatarUrl: true,
      },
    });

    // Create notification
    const notification = await prisma.notification.create({
      data: {
        recipientId: userId,
        issuerId: admin.id,
        type: "BAN_NOTICE" as any,
      },
      include: {
        issuer: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
          },
        },
      },
    });

    const notificationMessage = `Tài khoản của bạn đã bị khóa bởi quản trị viên. Vui lòng liên hệ hỗ trợ nếu bạn muốn kháng cáo.`;

    // Send notification via socket
    if (typeof global !== "undefined" && global.io && global.userSockets) {
      const socketId = global.userSockets.get(userId);
      if (socketId) {
        global.io.to(socketId).emit("notification", {
          ...notification,
          customMessage: notificationMessage,
          timestamp: new Date().toISOString(),
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: "User has been banned successfully",
      notification,
    });
  } catch (error) {
    console.error("Error banning user:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      {
        status:
          error instanceof Error && error.message === "Unauthorized"
            ? 401
            : 500,
      }
    );
  }
}
