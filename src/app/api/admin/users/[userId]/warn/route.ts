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
    const body = await req.json();
    const { message, deadline } = body;

    // Use default message if not provided
    const defaultMessage =
      "Bạn đã bị báo cáo, hệ thống cảnh báo bạn, bạn có 72 giờ để kháng nghị.";
    const warningMessage = message || defaultMessage;

    // Calculate deadline (72 hours from now) if not provided
    let deadlineDate: Date;
    if (deadline) {
      deadlineDate = new Date(deadline);
      if (deadlineDate <= new Date()) {
        return NextResponse.json(
          { error: "Deadline must be in the future" },
          { status: 400 }
        );
      }
    } else {
      deadlineDate = new Date(Date.now() + 72 * 60 * 60 * 1000); // 72 hours from now
    }

    // Get user to warn with current warning count
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        displayName: true,
        warningCount: true,
        bannedUntil: true,
      },
    } as any);

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Check if user is already banned
    const userWithBan = user as any;
    if (
      userWithBan.bannedUntil &&
      new Date(userWithBan.bannedUntil) > new Date()
    ) {
      return NextResponse.json(
        { error: "User is already banned" },
        { status: 400 }
      );
    }

    // Calculate new warning count
    const newWarningCount = (userWithBan.warningCount || 0) + 1;
    const shouldBan = newWarningCount >= 3;

    // Calculate ban until date (72 hours from now)
    const banUntilDate = shouldBan
      ? new Date(Date.now() + 72 * 60 * 60 * 1000) // 72 hours
      : null;

    // Get the most recent AI-flagged post for this user (within last 7 days)
    // Only warn for posts flagged by AI, not user reports
    const recentAIFlag = await prisma.moderationCase.findFirst({
      where: {
        userId: userId,
        postId: { not: null },
        source: "AI",
        createdAt: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
        },
      },
      orderBy: { createdAt: "desc" },
      select: { postId: true },
    } as any);

    const postId = recentAIFlag?.postId || null;

    // Only create warning if there's an AI-flagged post
    // Cảnh báo chỉ dành cho những bài viết bị AI flags
    if (!postId) {
      return NextResponse.json(
        {
          error:
            "Không tìm thấy bài viết nào bị AI flags để cảnh báo. Cảnh báo chỉ dành cho các bài viết bị AI phát hiện trong vòng 7 ngày gần đây.",
        },
        { status: 400 }
      );
    }

    // Create warning record
    const warning = await (prisma as any).userWarning.create({
      data: {
        userId,
        issuedBy: admin.id,
        message: warningMessage,
        deadline: deadlineDate,
        postId: postId,
      },
    });

    // Update user warning count, ban status, and last warning time
    await prisma.user.update({
      where: { id: userId },
      data: {
        warningCount: newWarningCount,
        ...(shouldBan && { bannedUntil: banUntilDate }),
        lastWarningAt: new Date(),
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

    // Determine notification type and message
    const notificationType = shouldBan ? "BAN_NOTICE" : ("WARNING" as any);
    let notificationMessage: string;

    // Format deadline date
    const formatDateTime = (date: Date) => {
      const d = date;
      const hours = String(d.getHours()).padStart(2, "0");
      const minutes = String(d.getMinutes()).padStart(2, "0");
      const seconds = String(d.getSeconds()).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const year = d.getFullYear();
      return `${hours}:${minutes}:${seconds} ${day}/${month}/${year}`;
    };

    if (shouldBan) {
      notificationMessage = `Bạn đã nhận ${newWarningCount} cảnh báo và đã bị khóa tài khoản.\n\n${warningMessage}\n\nBạn có 72 giờ để kháng cáo. Tài khoản sẽ được mở khóa sau: ${banUntilDate ? formatDateTime(banUntilDate) : ""}\n\nVui lòng vào profile của bạn để xem danh sách bài viết bị cảnh báo và kháng cáo.`;
    } else {
      notificationMessage = `Cảnh báo ${newWarningCount}/3\n\n${warningMessage}\n\nBạn có 72 giờ để giải quyết (đến: ${formatDateTime(deadlineDate)}).\n\nNếu nhận thêm ${3 - newWarningCount} cảnh báo nữa, tài khoản của bạn sẽ bị khóa.\n\nVui lòng vào profile của bạn để xem danh sách bài viết bị cảnh báo và kháng cáo.`;
    }

    // Create notification with postId if available
    const notification = await prisma.notification.create({
      data: {
        recipientId: userId,
        issuerId: admin.id,
        type: notificationType,
        postId: postId || undefined,
      } as any,
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

    // Send notification via socket with custom message
    if (typeof global !== "undefined" && global.io && global.userSockets) {
      const socketId = global.userSockets.get(userId);
      if (socketId) {
        global.io.to(socketId).emit("notification", {
          ...notification,
          customMessage: notificationMessage,
          deadline: deadlineDate.toISOString(),
          warningCount: newWarningCount,
          isBanned: shouldBan,
          banUntil: banUntilDate?.toISOString(),
          warningId: warning.id,
          timestamp: new Date().toISOString(),
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: shouldBan
        ? "User has been banned due to 3 warnings"
        : "Warning sent successfully",
      warning: {
        id: warning.id,
        warningCount: newWarningCount,
        isBanned: shouldBan,
        banUntil: banUntilDate?.toISOString(),
      },
      notification,
    });
  } catch (error) {
    console.error("Error sending warning:", error);
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
