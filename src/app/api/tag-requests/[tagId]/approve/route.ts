import { validateRequest } from "@/auth";
import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function POST(
  req: NextRequest,
  { params: { tagId } }: { params: { tagId: string } }
) {
  try {
    const { user: loggedInUser } = await validateRequest();

    if (!loggedInUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { action } = await req.json(); // "approve" or "reject"

    if (!["approve", "reject"].includes(action)) {
      return NextResponse.json({ 
        error: "Invalid action. Must be 'approve' or 'reject'" 
      }, { status: 400 });
    }

    // Lấy tag request
    const tagRequest = await prisma.post_tags.findUnique({
      where: { id: tagId },
      include: {
        posts: {
          select: { id: true, userId: true, content: true }
        },
        users: {
          select: { id: true, displayName: true, username: true }
        }
      }
    });

    if (!tagRequest) {
      return NextResponse.json({ 
        error: "Tag request not found" 
      }, { status: 404 });
    }

    // Kiểm tra quyền - chỉ user được tag mới có thể approve/reject
    if (tagRequest.userId !== loggedInUser.id) {
      return NextResponse.json({ 
        error: "You can only approve/reject tags for yourself" 
      }, { status: 403 });
    }

    // Cập nhật status
    const updatedTag = await prisma.post_tags.update({
      where: { id: tagId },
      data: { 
        status: action === "approve" ? "APPROVED" : "REJECTED" 
      },
      include: {
        users: {
          select: {
            id: true,
            displayName: true,
            username: true,
            avatarUrl: true,
          }
        }
      }
    });

    // Tạo notification cho post owner
    if (action === "approve") {
      await prisma.notification.create({
        data: {
          issuerId: loggedInUser.id,
          recipientId: tagRequest.posts.userId,
          postId: tagRequest.postId,
          type: "TAG",
        },
      });
    }

    return NextResponse.json({ 
      success: true,
      message: `Tag ${action}d successfully`,
      tag: {
        id: updatedTag.id,
        status: updatedTag.status,
        user: updatedTag.users,
      }
    });

  } catch (error) {
    console.error("Error updating tag request:", error);
    return NextResponse.json({ 
      error: "Internal server error" 
    }, { status: 500 });
  }
}
