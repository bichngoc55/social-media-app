import { validateRequest } from "@/auth";
import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function POST(
  req: NextRequest,
  {
    params: { postId, commentId },
  }: { params: { postId: string; commentId: string } }
) {
  try {
    const { user: loggedInUser } = await validateRequest();

    if (!loggedInUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { content } = await req.json();

    if (!content || content.trim().length === 0) {
      return NextResponse.json(
        {
          error: "Content is required",
        },
        { status: 400 }
      );
    }

    // Kiểm tra comment có tồn tại không
    const parentComment = await prisma.comment.findUnique({
      where: { id: commentId },
      select: {
        id: true,
        postId: true,
        userId: true,
        parentId: true, // Check if this is already a reply
        user: {
          select: {
            id: true,
            displayName: true,
            username: true,
          },
        },
      },
    });

    if (!parentComment) {
      return NextResponse.json(
        {
          error: "Comment not found",
        },
        { status: 404 }
      );
    }

    // Kiểm tra comment thuộc về post này
    if (parentComment.postId !== postId) {
      return NextResponse.json(
        {
          error: "Comment does not belong to this post",
        },
        { status: 400 }
      );
    }

    // Kiểm tra không thể reply một reply (chỉ cho phép 1 cấp)
    if (parentComment.parentId) {
      return NextResponse.json(
        {
          error:
            "Cannot reply to a reply. Only one level of replies is allowed.",
        },
        { status: 400 }
      );
    }

    // Tạo reply
    const reply = await prisma.comment.create({
      data: {
        content: content.trim(),
        userId: loggedInUser.id,
        postId,
        parentId: commentId,
      },
      include: {
        user: {
          select: {
            id: true,
            displayName: true,
            username: true,
            avatarUrl: true,
          },
        },
      },
    });

    // Tạo notification cho comment owner (nếu không phải chính mình)
    if (parentComment.userId !== loggedInUser.id) {
      await prisma.notification.create({
        data: {
          issuerId: loggedInUser.id,
          recipientId: parentComment.userId,
          postId,
          type: "COMMENT",
        },
      });
    }

    return NextResponse.json({
      success: true,
      message: "Reply created successfully",
      reply: {
        id: reply.id,
        content: reply.content,
        createdAt: reply.createdAt,
        user: reply.user,
      },
    });
  } catch (error) {
    console.error("Error creating reply:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
      },
      { status: 500 }
    );
  }
}
