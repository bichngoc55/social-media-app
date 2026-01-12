import { requireAdmin } from "@/lib/admin";
import prisma from "@/lib/prisma";
import { sendPermanentBanEmail } from "@/lib/email";
import { calculateUserViolationRate } from "@/lib/moderation";
import { NextRequest, NextResponse } from "next/server";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const admin = await requireAdmin();
    const { userId } = await params;
    const body = await req.json();
    const { message, deadline, postId } = body;

    // Calculate violation rate and check if warning is allowed
    const violationRate = await calculateUserViolationRate(userId);
    if (violationRate < 70) {
      return NextResponse.json(
        {
          error: `Cannot warn: Violation rate is only ${violationRate.toFixed(1)}%. Warning requires >= 70%.`,
        },
        { status: 400 }
      );
    }

    // Use default message if not provided
    // Updated to English
    const defaultMessage =
      "You have been reported. The system has issued a warning. You have 72 hours to appeal.";
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
    const shouldPermanentBan = newWarningCount >= 3;

    // Calculate ban until date (72 hours from now)
    const banUntilDate = shouldBan
      ? new Date(Date.now() + 72 * 60 * 60 * 1000) // 72 hours
      : null;

    let targetPostId = postId;

    // If no postId provided, try to find the most recent harmful post for this user
    if (!targetPostId) {
      const latestHarmfulPost = await prisma.post.findFirst({
        where: {
          userId: userId,
          harmful: true,
        },
        orderBy: {
          createdAt: "desc",
        },
        select: {
          id: true,
        },
      });

      if (latestHarmfulPost) {
        targetPostId = latestHarmfulPost.id;
      }
    }

    // Create warning record
    const warning = await prisma.userWarning.create({
      data: {
        userId,
        issuedBy: admin.id,
        message: warningMessage,
        deadline: deadlineDate,
        postId: targetPostId || null,
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

    // Determine notification type
    const notificationType = shouldBan ? "BAN_NOTICE" : ("WARNING" as any);

    // Create notification without custom message
    const notification = await prisma.notification.create({
      data: {
        recipientId: userId,
        issuerId: admin.id,
        type: notificationType,
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

    // Send permanent ban email if user has 3 warnings and has email
    if (shouldPermanentBan) {
      const userWithEmail = await prisma.user.findUnique({
        where: { id: userId },
        select: { email: true, displayName: true },
      });

      if (userWithEmail?.email) {
        await sendPermanentBanEmail(
          userWithEmail.email,
          userWithEmail.displayName,
          newWarningCount
        );
      }
    }

    // Send notification via socket
    if (typeof global !== "undefined" && global.io && global.userSockets) {
      const socketId = global.userSockets.get(userId);
      if (socketId) {
        global.io.to(socketId).emit("notification", {
          ...notification,
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
        violationRate: violationRate.toFixed(2),
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
