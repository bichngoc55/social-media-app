import { validateRequest } from "@/auth";
import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { getPostDataInclude } from "@/lib/types";

export async function GET(req: NextRequest) {
  try {
    const { user } = await validateRequest();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Ensure we only get warnings for the authenticated user
    const warnings = await prisma.userWarning.findMany({
      where: {
        userId: user.id, // Explicitly filter by authenticated user's ID
      },
      include: {
        admin: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
            role: true,
          },
        },
        post: {
          include: getPostDataInclude(user.id, true), // Lightweight mode
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json({ warnings });
  } catch (error) {
    console.error("Error fetching warnings:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
