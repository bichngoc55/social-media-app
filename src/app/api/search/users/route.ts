import { validateRequest } from "@/auth";
import prisma from "@/lib/prisma";
import { getUserDataSelect } from "@/lib/types";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const { user: loggedInUser } = await validateRequest();

    if (!loggedInUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const query = searchParams.get("q");

    if (!query || query.trim().length < 2) {
      return NextResponse.json({ users: [] });
    }

    const users = await prisma.user.findMany({
      where: {
        AND: [
          {
            NOT: { id: loggedInUser.id }, // Exclude self
          },
          {
            OR: [
              { displayName: { contains: query, mode: "insensitive" } },
              { username: { contains: query, mode: "insensitive" } },
            ],
          },
        ],
      },
      select: getUserDataSelect(loggedInUser.id),
      take: 10,
      orderBy: {
        displayName: "asc",
      },
    });

    return NextResponse.json({ users });

  } catch (error) {
    console.error("Error searching users:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
