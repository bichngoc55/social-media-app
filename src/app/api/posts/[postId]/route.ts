import { validateRequest } from "@/auth";
import prisma from "@/lib/prisma";
import { getPostDataInclude } from "@/lib/types";
import { NextResponse } from "next/server";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ postId: string }> }
) {
  const { postId } = await params;
  const { user } = await validateRequest();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const post = await prisma.post.findUnique({
    where: { id: postId },
    include: getPostDataInclude(user.id),
  });

  if (!post) return NextResponse.json({ error: "Not Found" }, { status: 404 });

  return NextResponse.json({ post });
}
