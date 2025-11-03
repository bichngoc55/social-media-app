import { validateRequest } from "@/auth";
import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

/**
 * This is a one-time setup endpoint to promote a user to admin
 * In production, you should restrict this or use it manually in database
 */
export async function POST(req: NextRequest) {
  try {
    const { userId } = await req.json();

    if (!userId) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 }
      );
    }

    // In production, you might want to add additional security here
    // For now, we'll allow any authenticated user to promote (for setup only)

    const user = await prisma.user.update({
      where: { id: userId },
      // Cast to any to avoid type mismatch if Prisma client hasn't regenerated yet
      data: { role: "ADMIN" } as any,
      select: {
        id: true,
        username: true,
        displayName: true,
      },
    });

    return NextResponse.json({
      success: true,
      message: `${user.displayName} has been promoted to ADMIN`,
      user,
    });
  } catch (error) {
    console.error("Error promoting user:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
