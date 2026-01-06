import { requireAdmin } from "@/lib/admin";
import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ appealId: string }> }
) {
  try {
    const admin = await requireAdmin();
    const { appealId } = await params;
    const { status, adminNotes } = await req.json();

    // Validate status
    const validStatuses = ["PENDING", "UNDER_REVIEW", "APPROVED", "REJECTED"];
    if (!status || !validStatuses.includes(status)) {
      return NextResponse.json(
        {
          error: `Invalid status. Must be one of: ${validStatuses.join(", ")}`,
        },
        { status: 400 }
      );
    }

    // Get appeal with relations
    const appeal = await prisma.appealUserReport.findUnique({
      where: { id: appealId },
      include: {
        post: {
          select: {
            id: true,
            harmful: true,
            userId: true,
          },
        },
        user: {
          select: {
            id: true,
            username: true,
            displayName: true,
          },
        },
      },
    });

    if (!appeal) {
      return NextResponse.json({ error: "Appeal not found" }, { status: 404 });
    }

    // Update appeal
    const updatedAppeal = await prisma.appealUserReport.update({
      where: { id: appealId },
      data: {
        status: status as any,
        adminNotes: adminNotes || undefined,
      },
    });

    // If approved, remove harmful flag from post
    if (status === "APPROVED" && appeal.post) {
      await prisma.post.update({
        where: { id: appeal.post.id },
        data: {
          harmful: false,
          harmfulTypes: [],
        },
      });

      // Send notification to user
      const notification = await prisma.notification.create({
        data: {
          recipientId: appeal.userId,
          issuerId: admin.id,
          type: "APPEAL_RESPONSE",
          postId: appeal.postId,
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
      await prisma.moderationCase.updateMany({
        where: { postId: appeal.post.id, status: "QUEUED" },
        data: {
          status: "DISMISSED",
          decision: "DISMISS",
          decisionAt: new Date(),
          updatedAt: new Date(),
          adminNotes: adminNotes || "Appeal approved by admin.",
        },
      });

      // Send via socket with custom message
      if (typeof global !== "undefined" && global.io && global.userSockets) {
        const socketId = global.userSockets.get(appeal.userId);
        if (socketId) {
          global.io.to(socketId).emit("notification", {
            ...notification,
            customMessage: `Your appeal has been approved. The post has been restored and is no longer flagged.`,
            timestamp: new Date().toISOString(),
          });
        }
      }
    }

    // If rejected, send notification
    if (status === "REJECTED") {
      const notification = await prisma.notification.create({
        data: {
          recipientId: appeal.userId,
          issuerId: admin.id,
          type: "APPEAL_RESPONSE",
          postId: appeal.postId,
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

      // Send via socket with custom message
      if (typeof global !== "undefined" && global.io && global.userSockets) {
        const socketId = global.userSockets.get(appeal.userId);
        if (socketId) {
          global.io.to(socketId).emit("notification", {
            ...notification,
            customMessage: `Your appeal has been rejected. ${adminNotes ? `Reason: ${adminNotes}` : ""}`,
            timestamp: new Date().toISOString(),
          });
        }
      }
    }

    return NextResponse.json({
      success: true,
      appeal: updatedAppeal,
    });
  } catch (error) {
    console.error("Error updating appeal:", error);
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
