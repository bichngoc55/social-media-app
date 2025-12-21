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

    // Prepare update data first
    const updateData: any = {};

    // Validate and set status
    if (status) {
      const validStatuses = ["PENDING", "REVIEWED", "RESOLVED", "DISMISSED"];
      if (validStatuses.includes(status)) {
        updateData.status = status;
      } else {
        return NextResponse.json(
          { error: `Invalid status: ${status}` },
          { status: 400 }
        );
      }
    }

    // Set admin notes if provided
    if (adminNotes !== undefined) {
      updateData.adminNotes = adminNotes;
    }

    // If deletePost is true and report has a post, delete the post
    // IMPORTANT: We need to set postId to null BEFORE deleting the post
    // to avoid cascade delete of the report
    if (deletePost && report.post) {
      try {
        // Check if post still exists
        const postExists = await prisma.post.findUnique({
          where: { id: report.post.id },
          select: { id: true, content: true, userId: true },
        });

        if (!postExists) {
          // Post already deleted, set postId to null
          console.log(`Post ${report.post.id} already deleted`);
          updateData.postId = null;
          // Continue to update report below
        } else {
          const postContent = postExists.content
            ? postExists.content.substring(0, 50)
            : "Bài viết";
          const postContentFull = postExists.content || "";

          // Get admin info for notifications
          const adminInfo = await prisma.user.findUnique({
            where: { id: admin.id },
            select: {
              id: true,
              username: true,
              displayName: true,
              avatarUrl: true,
            },
          });

          if (!adminInfo) {
            throw new Error("Admin user not found");
          }

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
                    issuer: adminInfo,
                    timestamp: new Date().toISOString(),
                    customMessage,
                  });
                }
              }
            });
          }

          // Set postId to null FIRST to break the cascade relationship
          updateData.postId = null;

          // Update report first to break the cascade relationship
          await prisma.report.update({
            where: { id: reportId },
            data: updateData,
          });

          // Now safe to delete the post (report won't be cascade deleted)
          await prisma.post.delete({
            where: { id: report.post.id },
          });

          // Fetch updated report with relations for response
          const updatedReport = await prisma.report.findUnique({
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
                },
              },
            },
          });

          return NextResponse.json({ report: updatedReport });
        }
      } catch (deleteError) {
        console.error("Error deleting post:", deleteError);
        // Continue with report update even if post deletion fails
        // The post might have been deleted already or there might be a constraint issue
      }
    }

    // Update report status (if not already updated above)
    // Only update if we have data to update
    if (Object.keys(updateData).length > 0) {
      const updatedReport = await prisma.report.update({
        where: { id: reportId },
        data: updateData,
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
    }

    // If no update data, return the original report
    return NextResponse.json({ report });
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
