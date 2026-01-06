import { validateRequest } from "@/auth";
import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ postId: string }> }
) {
  try {
    const { user } = await validateRequest();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { postId } = await params;

    // Check if post exists and belongs to user, and get harmful status
    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: {
        id: true,
        userId: true,
        harmful: true,
        harmfulTypes: true,
        createdAt: true,
      },
    });

    if (!post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    // Only allow checking own posts
    if (post.userId !== user.id) {
      return NextResponse.json(
        { error: "You can only check your own posts" },
        { status: 403 }
      );
    }

    const hasHarmful = post.harmful || false;

    // Check if there's an active warning for this post
    const activeWarning = await prisma.userWarning.findFirst({
      where: {
        userId: user.id,
        postId: postId,
        deadline: {
          gte: new Date(), // Deadline is in the future
        },
      },
      select: {
        id: true,
        deadline: true,
      },
    });

    // Check if there's already a pending appeal
    const existingAppeal = await prisma.appealUserReport.findFirst({
      where: {
        userId: user.id,
        postId: postId,
        status: {
          in: ["PENDING", "UNDER_REVIEW"],
        },
      },
      select: {
        id: true,
        status: true,
      },
    });

    return NextResponse.json({
      hasAIFlag: hasHarmful, // Đổi tên để tương thích với component, nhưng thực chất là harmful
      hasHarmful: hasHarmful,
      hasActiveWarning: !!activeWarning,
      hasPendingAppeal: !!existingAppeal,
      harmfulTypes: post?.harmfulTypes || [],
      activeWarning: activeWarning || null,
      existingAppeal: existingAppeal || null,
    });
  } catch (error) {
    console.error("Error checking AI flag status:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
