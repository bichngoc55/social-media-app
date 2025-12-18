import { requireAdmin } from "@/lib/admin";
import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ reportId: string }> }
) {
  try {
    const { reportId } = await params;
    const admin = await requireAdmin();

    const { status, adminNotes, deletePost } = await req.json();

    // Get report with relations
    const report = await prisma.report.findUnique({
      where: { id: reportId },
      include: {
        reporter: {
          select: {
            id: true,
            username: true,
            displayName: true,
          },
        },
        reported: {
          select: {
            id: true,
            username: true,
            displayName: true,
          },
        },
        post: {
          select: {
            id: true,
            content: true,
            userId: true,
          },
        },
      },
    });

    if (!report) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }

    // If deletePost is true and report has a post, delete the post
    if (deletePost && report.post) {
      try {
        // Check if post still exists
        const postExists = await prisma.post.findUnique({
          where: { id: report.post.id },
          select: { id: true, content: true, userId: true },
        });

        if (!postExists) {
          // Post already deleted, just update report status
          console.log(`Post ${report.post.id} already deleted`);
        } else {
          const postContent = postExists.content
            ? postExists.content.substring(0, 50)
            : "Bài viết";
          const postContentFull = postExists.content || "";

          // Create notifications before deleting the post
          const notifications = await Promise.all([
            // Notify reporter that their report was resolved and post was deleted
            prisma.notification.create({
              data: {
                recipientId: report.reporter.id,
                issuerId: admin.id,
                type: "MESSAGE",
                postId: null,
              },
            }),
            // Notify post owner (if different from reporter) that their post was deleted
            postExists.userId !== report.reporter.id
              ? prisma.notification.create({
                  data: {
                    recipientId: postExists.userId,
                    issuerId: admin.id,
                    type: "MESSAGE",
                    postId: null,
                  },
                })
              : Promise.resolve(null),
          ]);

          // Send socket notifications if available
          if (
            typeof global !== "undefined" &&
            global.io &&
            global.userSockets
          ) {
            notifications.forEach((notification, index) => {
              if (notification) {
                const socketId = global.userSockets.get(
                  notification.recipientId
                );
                if (socketId) {
                  // Include custom message in socket emission (not stored in DB)
                  const customMessage =
                    index === 0
                      ? `Bài viết bạn báo cáo ("${postContent}${postContentFull.length > 50 ? "..." : ""}") đã bị xóa bởi quản trị viên.`
                      : `Bài viết của bạn ("${postContent}${postContentFull.length > 50 ? "..." : ""}") đã bị xóa bởi quản trị viên do vi phạm chính sách.`;

                  global.io.to(socketId).emit("notification", {
                    ...notification,
                    timestamp: new Date().toISOString(),
                    customMessage,
                  });
                }
              }
            });
          }

          // Delete the post after creating notifications
          await prisma.post.delete({
            where: { id: report.post.id },
          });
        }
      } catch (deleteError) {
        console.error("Error deleting post:", deleteError);
        // Continue with report update even if post deletion fails
        // The post might have been deleted already or there might be a constraint issue
      }
    }

    // Update report status
    // Note: If post was deleted, it will be null in the response
    const updatedReport = await prisma.report.update({
      where: { id: reportId },
      data: {
        ...(status && { status }),
        ...(adminNotes !== undefined && { adminNotes }),
      },
      include: {
        reporter: {
          select: {
            id: true,
            username: true,
            displayName: true,
          },
        },
        reported: {
          select: {
            id: true,
            username: true,
            displayName: true,
          },
        },
        post: {
          select: {
            id: true,
            content: true,
          },
        },
      },
    });

    return NextResponse.json({ report: updatedReport });
  } catch (error) {
    console.error("Error updating report:", error);
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
