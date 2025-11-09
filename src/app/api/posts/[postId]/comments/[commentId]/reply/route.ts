import { validateRequest } from "@/auth";
import prisma from "@/lib/prisma";
import { getCommentDataInclude } from "@/lib/types";
import { createCommentSchema } from "@/lib/validation";
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

    const { content, mediaIds = [] } = await req.json();

    if (!content?.trim() && (!mediaIds || mediaIds.length === 0)) {
      return NextResponse.json(
        { error: "Content or images required" },
        { status: 400 }
      );
    }

    const { content: contentValidated } = createCommentSchema.parse({
      content: content || "",
    });

    const parentComment = await prisma.comment.findUnique({
      where: { id: commentId },
    });

    if (!parentComment) {
      return NextResponse.json(
        { error: "Parent comment not found" },
        { status: 404 }
      );
    }

    const reply = await prisma.comment.create({
      data: {
        content: contentValidated,
        userId: loggedInUser.id,
        postId,
        parentId: commentId,
        attachments: {
          connect: mediaIds.map((id: string) => ({ id })),
        },
      },
      include: getCommentDataInclude(loggedInUser.id),
    });

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
      reply: JSON.parse(JSON.stringify(reply)),
    });
  } catch (error) {
    console.error("Error creating reply:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
