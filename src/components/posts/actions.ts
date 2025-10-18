"use server";

import { validateRequest } from "@/auth";
import prisma from "@/lib/prisma";
import { getPostDataInclude } from "@/lib/types";

export async function deletePost(id: string) {
  const { user } = await validateRequest();

  if (!user) throw new Error("Unauthorized");

  const post = await prisma.post.findUnique({
    where: { id },
  });

  if (!post) throw new Error("Post not found");

  if (post.userId !== user.id) throw new Error("Unauthorized");

  const deletedPost = await prisma.post.delete({
    where: { id },
    include: getPostDataInclude(user.id),
  });

  return deletedPost;
}

export async function toggleBookmark(postId: string) {
  const { user } = await validateRequest();

  if (!user) throw new Error("Unauthorized");

  const existingBookmark = await prisma.bookmark.findUnique({
    where: {
      userId_postId: {
        userId: user.id,
        postId: postId,
      },
    },
  });

  if (existingBookmark) {
    await prisma.bookmark.delete({
      where: {
        userId_postId: {
          userId: user.id,
          postId: postId,
        },
      },
    });
  } else {
    await prisma.bookmark.create({
      data: {
        userId: user.id,
        postId: postId,
      },
    });
  }

  return postId;
}

export async function updatePostPrivacy(input: {
  postId: string;
  privacy: "DRAFT" | "FOLLOWERS" | "PUBLIC";
}) {
  const { user } = await validateRequest();

  if (!user) throw new Error("Unauthorized");

  const post = await prisma.post.findUnique({
    where: { id: input.postId },
  });

  if (!post) throw new Error("Post not found");

  if (post.userId !== user.id) throw new Error("Unauthorized");

  const updatedPost = await prisma.post.update({
    where: { id: input.postId },
    data: { privacy: input.privacy },
    include: getPostDataInclude(user.id),
  });

  return updatedPost;
}