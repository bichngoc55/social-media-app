import prisma from "@/lib/prisma";

export async function sendNotification(
  recipientId: string,
  issuerId: string,
  type: "LIKE" | "FOLLOW" | "COMMENT" | "MENTION" | "MESSAGE",
  postId?: string
) {
  try {
    const notification = await prisma.notification.create({
      data: {
        recipientId,
        issuerId,
        type,
        postId,
      },
      include: {
        issuer: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
          },
        },
        post: postId
          ? {
              select: {
                id: true,
                content: true,
              },
            }
          : undefined,
      },
    });

    if (typeof global !== "undefined" && global.io && global.userSockets) {
      const socketId = global.userSockets.get(recipientId);
      if (socketId) {
        global.io.to(socketId).emit("notification", {
          ...notification,
          timestamp: new Date().toISOString(),
        });
      }
    }

    return notification;
  } catch (error) {
    console.error("Error sending notification:", error);
  }
}

export function extractMentions(content: string): string[] {
  const mentionRegex = /@(\w+)/g;
  const mentions: string[] = [];
  let match;

  while ((match = mentionRegex.exec(content)) !== null) {
    mentions.push(match[1]);
  }

  return [...new Set(mentions)];
}

export async function processMentions(
  content: string,
  mentionedBy: string,
  postId?: string,
  commentId?: string
) {
  const usernames = extractMentions(content);

  if (usernames.length === 0) return;

  const users = await prisma.user.findMany({
    where: {
      username: {
        in: usernames,
        mode: "insensitive",
      },
    },
    select: { id: true, username: true },
  });

  for (const user of users) {
    if (user.id === mentionedBy) continue;

    await prisma.mention.create({
      data: {
        userId: user.id,
        mentionedBy,
        postId,
        commentId,
      },
    });

    await sendNotification(user.id, mentionedBy, "MENTION", postId);
  }
}
