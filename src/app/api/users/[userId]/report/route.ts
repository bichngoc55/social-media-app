import { validateRequest } from "@/auth";
import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params;
    const { user: loggedInUser } = await validateRequest();

    if (!loggedInUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { type, reason, postId } = await req.json();

    // Không thể báo cáo chính mình
    if (loggedInUser.id === userId) {
      return NextResponse.json(
        {
          error: "Cannot report yourself",
        },
        { status: 400 }
      );
    }

    // Kiểm tra user có tồn tại không
    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, displayName: true },
    });

    if (!targetUser) {
      return NextResponse.json(
        {
          error: "User not found",
        },
        { status: 404 }
      );
    }

    // Kiểm tra post có tồn tại không (nếu có postId)
    if (postId) {
      const post = await prisma.post.findUnique({
        where: { id: postId },
        select: { id: true, userId: true },
      });

      if (!post) {
        return NextResponse.json(
          {
            error: "Post not found",
          },
          { status: 404 }
        );
      }

      // Kiểm tra post có thuộc về user được báo cáo không
      if (post.userId !== userId) {
        return NextResponse.json(
          {
            error: "Post does not belong to the reported user",
          },
          { status: 400 }
        );
      }
    }

    // Kiểm tra xem đã báo cáo user này chưa (trong vòng 24h)
    const recentReport = await prisma.report.findFirst({
      where: {
        reporterId: loggedInUser.id,
        reportedId: userId,
        createdAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // 24 hours ago
        },
      },
    });

    if (recentReport) {
      return NextResponse.json(
        {
          error:
            "You have already reported this user recently. Please wait 24 hours before reporting again.",
        },
        { status: 400 }
      );
    }

    // Tạo report
    const report = await prisma.report.create({
      data: {
        reporterId: loggedInUser.id,
        reportedId: userId,
        postId: postId || null,
        type,
        reason,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Report submitted successfully. Thank you for helping keep our community safe.`,
      reportId: report.id,
    });
  } catch (error) {
    console.error("Error reporting user:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
      },
      { status: 500 }
    );
  }
}
