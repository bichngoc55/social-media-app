"use server";

import { validateRequest } from "@/auth";
import prisma from "@/lib/prisma";
import { processMentions } from "@/lib/socket";
import { getPostDataInclude } from "@/lib/types";
import { createPostSchema } from "@/lib/validation";

export async function submitPost(input: {
  content: string;
  mediaIds: string[];
  privacy: "DRAFT" | "FOLLOWERS" | "PUBLIC";
  mediaLayout?: "GRID" | "CAROUSEL" | "COLUMNS" | "FRAME";
  taggedUserIds?: string[];
}) {
  const { user } = await validateRequest();

  if (!user) throw new Error("Unauthorized");

  const parsed = createPostSchema.parse(input);
  const {
    content,
    mediaIds,
    privacy,
    mediaLayout,
    taggedUserIds = [],
  } = parsed;

  const newPost = await prisma.post.create({
    data: {
      content,
      userId: user.id,
      privacy,
      ...(mediaLayout && { mediaLayout: mediaLayout as any }),
      attachments: {
        connect: mediaIds.map((id) => ({ id })),
      },
      post_tags: {
        create: taggedUserIds
          .filter((id) => id !== user.id) // Không thể tag chính mình
          .map((userId) => ({
            userId,
            status: "APPROVED", // Tự động approve khi tag trong lúc tạo post
          })),
      },
    },
    include: getPostDataInclude(user.id),
  });

  await processMentions(content, user.id, newPost.id);

  return newPost;
}
