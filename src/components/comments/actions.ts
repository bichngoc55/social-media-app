"use server";

import { validateRequest } from "@/auth";
import prisma from "@/lib/prisma";
import { sendNotification, processMentions } from "@/lib/socket";
import { getCommentDataInclude } from "@/lib/types";
import { createCommentSchema } from "@/lib/validation";

export async function submitComment({
  postId,
  content,
  mediaIds = [],
}: {
  postId: string;
  content: string;
  mediaIds?: string[];
}) {
  const { user } = await validateRequest();

  if (!user) throw "Unauthorized";

  const { content: contentValidated } = createCommentSchema.parse({ content });
  // Load post and its author from DB (plain JS objects) to avoid passing
  // complex objects from the client into a server action.
  const post = await prisma.post.findUnique({
    where: { id: postId },
    include: { user: true },
  });

  if (!post) throw "Post not found";

  const newComment = await prisma.comment.create({
    data: {
      content: contentValidated,
      postId: post.id,
      userId: user.id,
      ...(mediaIds.length > 0 && {
        attachments: {
          connect: mediaIds.map((id) => ({ id })),
        },
      }),
    },
    include: getCommentDataInclude(user.id),
  });

  const mentionMatches = contentValidated.match(/@(\w+)/g) || [];
  const mentionedUsernames = mentionMatches.map((match) =>
    match.slice(1).toLowerCase()
  );

  await processMentions(contentValidated, user.id, post.id, newComment.id);

  const isPostAuthorMentioned = mentionedUsernames.includes(
    post.user.username.toLowerCase()
  );
  if (post.user.id !== user.id && !isPostAuthorMentioned) {
    await sendNotification(post.user.id, user.id, "COMMENT", post.id);
  }
  return JSON.parse(JSON.stringify(newComment));
}

export async function deleteComment(id: string) {
  const { user } = await validateRequest();

  if (!user) throw "Unauthorized";

  const comment = await prisma.comment.findUnique({
    where: { id },
  });

  if (!comment) throw "Comment not found";

  if (comment.userId !== user.id) throw "Unauthorized";

  const deletedComment = await prisma.comment.delete({
    where: { id },
    include: getCommentDataInclude(user.id),
  });

  // Ensure we return a plain serializable object from the server action.
  return JSON.parse(JSON.stringify(deletedComment));
}
