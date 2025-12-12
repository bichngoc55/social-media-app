import { validateRequest } from "@/auth";
import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params;
    const { user: loggedInUser } = await validateRequest();

    if (!loggedInUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Kiểm tra xem user hiện tại có chặn user này không
    const isBlockedByMe = await prisma.userBlock.findUnique({
      where: {
        blockerId_blockedId: {
          blockerId: loggedInUser.id,
          blockedId: userId,
        },
      },
    });

    // Kiểm tra xem user này có chặn user hiện tại không
    const isBlockedByThem = await prisma.userBlock.findUnique({
      where: {
        blockerId_blockedId: {
          blockerId: userId,
          blockedId: loggedInUser.id,
        },
      },
    });

    return NextResponse.json({
      isBlockedByMe: !!isBlockedByMe,
      isBlockedByThem: !!isBlockedByThem,
      blockReason: isBlockedByMe?.reason || null,
    });
  } catch (error) {
    console.error("Error checking block status:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
      },
      { status: 500 }
    );
  }
}
