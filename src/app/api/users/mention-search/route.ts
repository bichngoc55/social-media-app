import { validateRequest } from "@/auth";
import prisma from "@/lib/prisma";
import { getUserDataSelect } from "@/lib/types";
import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const { user: loggedInUser } = await validateRequest();

    if (!loggedInUser) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const query = req.nextUrl.searchParams.get("q") || "";

    if (!query.trim()) {
      return Response.json([]);
    }

    const followingUsers = await prisma.follow.findMany({
      where: { followerId: loggedInUser.id },
      select: { followingId: true },
    });

    const followingIds = followingUsers.map((f) => f.followingId);

    const blockedUsers = await prisma.userBlock.findMany({
      where: {
        OR: [{ blockerId: loggedInUser.id }, { blockedId: loggedInUser.id }],
      },
      select: { blockerId: true, blockedId: true },
    });

    const blockedUserIds = new Set([
      ...blockedUsers.map((b) => b.blockedId),
      ...blockedUsers.map((b) => b.blockerId),
    ]);
    blockedUserIds.delete(loggedInUser.id);

    const users = await prisma.user.findMany({
      where: {
        AND: [
          {
            OR: [
              { username: { contains: query, mode: "insensitive" } },
              { displayName: { contains: query, mode: "insensitive" } },
            ],
          },
          {
            id: {
              notIn: Array.from(blockedUserIds),
              not: loggedInUser.id,
            },
          },
        ],
      },
      select: getUserDataSelect(loggedInUser.id),
      orderBy: [{ username: "asc" }],
      take: 10,
    });

    return Response.json(users);
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
