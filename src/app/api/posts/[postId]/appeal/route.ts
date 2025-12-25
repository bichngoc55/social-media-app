import { validateRequest } from "@/auth";
import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ postId: string }> }
) {
  try {
    const { user } = await validateRequest();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { postId } = await params;
    const { appealReason } = await req.json();

    if (
      !appealReason ||
      typeof appealReason !== "string" ||
      !appealReason.trim()
    ) {
      return NextResponse.json(
        { error: "Appeal reason is required" },
        { status: 400 }
      );
    }

    // Check if post exists and belongs to user
    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: { id: true, userId: true },
    });

    if (!post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    if (post.userId !== user.id) {
      return NextResponse.json(
        { error: "You can only appeal your own posts" },
        { status: 403 }
      );
    }

    // Check if post has harmful = true (bị AI cảnh báo)
    const postWithHarmful = await prisma.post.findUnique({
      where: { id: postId },
      select: { id: true, harmful: true },
    });

    if (!postWithHarmful || !postWithHarmful.harmful) {
      return NextResponse.json(
        {
          error:
            "Chỉ có thể kháng cáo các bài viết bị AI cảnh báo (harmful = true)",
        },
        { status: 400 }
      );
    }

    // Check if appeal already exists
    const existingAppeal = await prisma.appealUserReport.findFirst({
      where: {
        userId: user.id,
        postId: postId,
        status: "PENDING",
      },
    });

    if (existingAppeal) {
      return NextResponse.json(
        { error: "You have already submitted an appeal for this post" },
        { status: 400 }
      );
    }

    // Create appeal
    const appeal = await prisma.appealUserReport.create({
      data: {
        userId: user.id,
        postId: postId,
        appealReason: appealReason.trim(),
        status: "PENDING",
      },
    });

    return NextResponse.json({
      success: true,
      message: "Appeal submitted successfully",
      appeal,
    });
  } catch (error) {
    console.error("Error creating appeal:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
