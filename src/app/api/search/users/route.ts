import { validateRequest } from "@/auth";
import prisma from "@/lib/prisma";
import { getUserDataSelect } from "@/lib/types";
import { NextRequest, NextResponse } from "next/server";

export async function searchUsersLogic(query: string, currentUserId: string) {
  if (!query || query.trim().length < 1) return [];

  const rawUsers = await prisma.$queryRaw<{ id: string }[]>`
    SELECT id,
      GREATEST(
        similarity(username, ${query}), 
        similarity("displayName", ${query})
      ) as match_score
    FROM users
    WHERE 
      id != ${currentUserId}
      AND (
        similarity(username, ${query}) > 0.15
        OR similarity("displayName", ${query}) > 0.15
        OR username ILIKE ${`%${query}%`} 
        OR "displayName" ILIKE ${`%${query}%`}
      )
    ORDER BY match_score DESC
    LIMIT 10;
  `;

  if (rawUsers.length === 0) return [];

  const userIds = rawUsers.map((u) => u.id);

  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: getUserDataSelect(currentUserId, true),
  });

  return userIds
    .map((id) => users.find((u) => u.id === id))
    .filter((u) => u !== undefined);
}

export async function GET(req: NextRequest) {
  try {
    const { user } = await validateRequest();
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const query = req.nextUrl.searchParams.get("q") || "";

    const users = await searchUsersLogic(query, user.id);

    return NextResponse.json({ users });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Server Error" }, { status: 500 });
  }
}
