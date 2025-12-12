import { validateRequest } from "@/auth";
import prisma from "@/lib/prisma";
import { sendNotification } from "@/lib/socket";
import { getCommentDataInclude } from "@/lib/types";
import { createCommentSchema } from "@/lib/validation";
import { NextRequest, NextResponse } from "next/server";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ postId: string; commentId: string }> }
) {
  try {
    const { postId, commentId } = await params;
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

    // 1. Fetch parent comment AND the post author in one query
    const parentComment = await prisma.comment.findUnique({
      where: { id: commentId },
      include: {
        post: {
          select: {
            userId: true, // Get the Post Author ID
          },
        },
      },
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
    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: { userId: true },
    });
    if (!post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    console.log(
      "creator id",
      post?.userId,
      "logged in user id",
      loggedInUser.id
    );

    if (post?.userId !== loggedInUser.id) {
      await sendNotification(post.userId, loggedInUser.id, "COMMENT", postId);
    }

    if (
      parentComment.userId !== loggedInUser.id &&
      parentComment.userId !== post?.userId
    ) {
      {
        await sendNotification(
          parentComment.userId,
          loggedInUser.id,
          "COMMENT",
          postId
        );
      }
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
