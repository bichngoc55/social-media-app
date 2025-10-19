import { validateRequest } from "@/auth";
import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function POST(
  req: NextRequest,
  { params: { postId } }: { params: { postId: string } }
) {
  try {
    const { user: loggedInUser } = await validateRequest();

    if (!loggedInUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { userIds } = await req.json();

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return NextResponse.json(
        {
          error: "User IDs are required",
        },
        { status: 400 }
      );
    }

    // Kiểm tra post có tồn tại không
    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: {
        id: true,
        userId: true,
        content: true,
      },
    });

    if (!post) {
      return NextResponse.json(
        {
          error: "Post not found",
        },
        { status: 404 }
      );
    }

    // Kiểm tra quyền - chỉ có thể tag trong post của mình
    if (post.userId !== loggedInUser.id) {
      return NextResponse.json(
        {
          error: "You can only tag users in your own posts",
        },
        { status: 403 }
      );
    }

    // Kiểm tra users có tồn tại không
    const users = await prisma.user.findMany({
      where: {
        id: { in: userIds },
        id: { not: loggedInUser.id }, // Không thể tag chính mình
      },
      select: { id: true, displayName: true, username: true },
    });

    if (users.length === 0) {
      return NextResponse.json(
        {
          error: "No valid users found to tag",
        },
        { status: 400 }
      );
    }

    // Tạo tag requests
    const tagRequests = await Promise.all(
      users.map((user) =>
        prisma.post_tags.upsert({
          where: {
            postId_userId: {
              postId,
              userId: user.id,
            },
          },
          create: {
            postId,
            userId: user.id,
            status: "PENDING",
          },
          update: {
            status: "PENDING", // Reset status nếu đã tồn tại
          },
        })
      )
    );

    // Tạo notifications cho tagged users
    await Promise.all(
      users.map((user) =>
        prisma.notification.create({
          data: {
            issuerId: loggedInUser.id,
            recipientId: user.id,
            postId,
            type: "TAG_REQUEST",
          },
        })
      )
    );

    return NextResponse.json({
      success: true,
      message: `Tagged ${users.length} user(s)`,
      taggedUsers: users.map((user) => ({
        id: user.id,
        displayName: user.displayName,
        username: user.username,
      })),
    });
  } catch (error) {
    console.error("Error tagging users:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
      },
      { status: 500 }
    );
  }
}

export async function GET(
  req: NextRequest,
  { params: { postId } }: { params: { postId: string } }
) {
  try {
    const { user: loggedInUser } = await validateRequest();

    if (!loggedInUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Lấy danh sách users được tag trong post
    const taggedUsers = await prisma.post_tags.findMany({
      where: { postId },
      include: {
        users: {
          select: {
            id: true,
            displayName: true,
            username: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      taggedUsers: taggedUsers.map((tag) => ({
        id: tag.id,
        userId: tag.userId,
        status: tag.status,
        createdAt: tag.createdAt,
        user: tag.users,
      })),
    });
  } catch (error) {
    console.error("Error fetching tagged users:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
      },
      { status: 500 }
    );
  }
}
