import { validateRequest } from "@/auth";
import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ postId: string }> }
) {
  try {
    const { postId } = await params;
    const { user: loggedInUser } = await validateRequest();

    if (!loggedInUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const postResult = await prisma.$queryRaw<
      Array<{ topicEmbeddings: string[] }>
    >`
      SELECT "topicEmbeddings"::text[]
      FROM "posts"
      WHERE id = ${postId}
    `;

    const topicEmbeddings = postResult[0]?.topicEmbeddings || [];

    await prisma.$transaction(async (tx) => {
      await tx.postBlock.create({
        data: {
          userId: loggedInUser.id,
          postId,
        },
      });
      if (topicEmbeddings.length > 0) {
        await tx.$executeRaw`
          UPDATE users
          SET "dislikedPostTopicsEmbedding" = 
            (
              SELECT array_agg(DISTINCT v) 
              FROM unnest(array_cat("dislikedPostTopicsEmbedding", ${topicEmbeddings}::vector[])) as v
            )
          WHERE id = ${loggedInUser.id}
        `;
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error blocking post:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
