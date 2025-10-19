import { validateRequest } from "@/auth";
import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function POST(
  req: NextRequest,
  { params: { userId } }: { params: { userId: string } }
) {
  try {
    const { user: loggedInUser } = await validateRequest();

    if (!loggedInUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { reason } = await req.json();

    // Không thể chặn chính mình
    if (loggedInUser.id === userId) {
      return NextResponse.json(
        {
          error: "Cannot block yourself",
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

    // Kiểm tra xem đã block chưa
    const existingBlock = await prisma.userBlock.findFirst({
      where: {
        blockerId: loggedInUser.id,
        blockedId: userId,
      },
    });

    let block;
    if (existingBlock) {
      // Cập nhật lý do nếu đã block
      block = await prisma.userBlock.update({
        where: { id: existingBlock.id },
        data: { reason: reason || null },
      });
    } else {
      // Tạo block record mới
      block = await prisma.userBlock.create({
        data: {
          blockerId: loggedInUser.id,
          blockedId: userId,
          reason: reason || null,
        },
      });
    }

    // Note: Follow relationships will be handled by the frontend
    // when checking if users can see each other's content

    return NextResponse.json({
      success: true,
      message: `You have blocked ${targetUser.displayName}`,
      block,
    });
  } catch (error) {
    console.error("Error blocking user:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params: { userId } }: { params: { userId: string } }
) {
  try {
    const { user: loggedInUser } = await validateRequest();

    if (!loggedInUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Xóa block record
    const deletedBlock = await prisma.userBlock.deleteMany({
      where: {
        blockerId: loggedInUser.id,
        blockedId: userId,
      },
    });

    if (deletedBlock.count === 0) {
      return NextResponse.json(
        {
          error: "User is not blocked",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "User has been unblocked",
    });
  } catch (error) {
    console.error("Error unblocking user:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
      },
      { status: 500 }
    );
  }
}
