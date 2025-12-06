"use server";

import { validateRequest } from "@/auth";
import prisma from "@/lib/prisma";
import { processMentions } from "@/lib/socket";
import { getPostDataInclude } from "@/lib/types";
import { createPostSchema } from "@/lib/validation";
import {
  analyzePostWithGemini,
  getMultimodalEmbedding,
  normalizeVector,
} from "@/lib/vertex";

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

  // Extract hashtags from content
  const hashtagRegex = /#(\w+)/g;
  const hashtags: string[] = [];
  let match;
  while ((match = hashtagRegex.exec(content)) !== null) {
    hashtags.push(match[1].toLowerCase());
  }
  const uniqueHashtags = [...new Set(hashtags)];

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
      hashtags: uniqueHashtags,
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
  let analysis: {
    sentimentScore: number;
    emotion: string;
    harmful: boolean;
    harmfulTypes: string[];
  } = {
    sentimentScore: 0.5,
    emotion: "NEUTRAL",
    harmful: false,
    harmfulTypes: [],
  };

  try {
    const imageUrl = newPost.attachments.find((m) => m.type === "IMAGE")?.url;
    const videoUrl = newPost.attachments.find((m) => m.type === "VIDEO")?.url;

    const [embedding, geminiAnalysis] = await Promise.all([
      getMultimodalEmbedding(
        content || undefined,
        imageUrl ?? undefined,
        videoUrl ?? undefined
      ),
      analyzePostWithGemini(
        content || undefined,
        imageUrl ?? undefined,
        videoUrl ?? undefined
      ),
    ]);

    const normalizedVector = normalizeVector(embedding);
    analysis = geminiAnalysis;
    // Update post with embedding and sentiment
    await prisma.$executeRaw`
      UPDATE "posts"
      SET 
        embedding = ${normalizedVector}::vector,
        emotions = ${analysis.emotion}::"EMOTION",
        "emotionScore" = ${analysis.sentimentScore},
        harmful = ${analysis.harmful},
        "harmfulTypes" = ${analysis.harmfulTypes}::text[]
      WHERE id = ${newPost.id}
    `;
  } catch (error) {
    console.error("Error generating embedding for post:", error);
  }
  const currentUserStats = await prisma.user.findUnique({
    where: { id: user.id },
    select: { emotionScore: true, _count: { select: { posts: true } } },
  });

  const currentScore = currentUserStats?.emotionScore ?? 0.5;
  const postCount = (currentUserStats?._count.posts ?? 0) || 1;

  const newAverageScore =
    (currentScore * (postCount - 1) + analysis.sentimentScore) / postCount;

  await prisma.user.update({
    where: { id: user.id },
    data: {
      generalEmotion:
        newAverageScore > 0.55
          ? "POSITIVE"
          : newAverageScore < 0.45
            ? "NEGATIVE"
            : "NEUTRAL",
      emotionScore: newAverageScore,
    },
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
