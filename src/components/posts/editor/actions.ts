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

  // Lọc ra những user đã được follow
  const taggedUserIdsFiltered = taggedUserIds.filter((id) => id !== user.id); // Không thể tag chính mình

  if (taggedUserIdsFiltered.length > 0) {
    // Kiểm tra xem các user có được follow không
    const followingUsers = await prisma.follow.findMany({
      where: {
        followerId: user.id,
        followingId: { in: taggedUserIdsFiltered },
      },
      select: { followingId: true },
    });

    const followingIds = new Set(followingUsers.map((f) => f.followingId));
    const notFollowingIds = taggedUserIdsFiltered.filter(
      (id) => !followingIds.has(id)
    );

    if (notFollowingIds.length > 0) {
      // Lấy thông tin user để hiển thị lỗi
      const notFollowingUsers = await prisma.user.findMany({
        where: { id: { in: notFollowingIds } },
        select: { displayName: true, username: true },
      });

      throw new Error(
        `Bạn cần follow những user sau trước khi tag: ${notFollowingUsers.map((u) => u.displayName).join(", ")}`
      );
    }
  }

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
        create: taggedUserIdsFiltered.map((userId) => ({
          userId,
          status: "PENDING", // Tạo tag request, cần user approve
        })),
      },
    },
    include: getPostDataInclude(user.id),
  });

  // Tạo notifications cho các tagged users
  if (taggedUserIdsFiltered.length > 0) {
    await Promise.all(
      taggedUserIdsFiltered.map((userId) =>
        prisma.notification.create({
          data: {
            issuerId: user.id,
            recipientId: userId,
            postId: newPost.id,
            type: "TAG_REQUEST",
          },
        })
      )
    );
  }

  await processMentions(content, user.id, newPost.id);

  return newPost;
}
