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
}) {
  const { user } = await validateRequest();

  if (!user) throw new Error("Unauthorized");

  const { content, mediaIds, privacy } = createPostSchema.parse(input);

  const newPost = await prisma.post.create({
    data: {
      content,
      userId: user.id,
      privacy,
      attachments: {
        connect: mediaIds.map((id) => ({ id })),
      },
    },
    include: getPostDataInclude(user.id),
  });

  await processMentions(content, user.id, newPost.id);

  return newPost;
}
