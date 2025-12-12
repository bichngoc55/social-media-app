"use server";

import { validateRequest } from "@/auth";
import prisma from "@/lib/prisma";
import { processMentions, sendNotification } from "@/lib/socket";
import { getPostDataInclude } from "@/lib/types";
import {
  analyzePostWithGemini,
  getMultimodalEmbedding,
  getTextEmbedding,
  normalizeVector,
} from "@/lib/vertex";

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
export async function updatePost(input: {
  postId: string;
  content: string;
  privacy: "DRAFT" | "FOLLOWERS" | "PUBLIC";
  mediaLayout?: "GRID" | "CAROUSEL" | "COLUMNS" | "FRAME";
  taggedUserIds?: string[];
  mediaIdsToDelete?: string[];
}) {
  const { user } = await validateRequest();
  if (!user) throw new Error("Unauthorized");

  const post = await prisma.post.findUnique({
    where: { id: input.postId },
    include: {
      post_tags: true,
      attachments: true,
    },
  });

  if (!post) throw new Error("Post not found");
  if (post.userId !== user.id) throw new Error("Unauthorized");

  const {
    content,
    privacy,
    mediaLayout,
    taggedUserIds = [],
    mediaIdsToDelete = [],
  } = input;
  const isContentChanged = input.content !== post.content;
  const isMediaDeleted =
    input.mediaIdsToDelete && input.mediaIdsToDelete.length > 0;

  const shouldRecalculateEmbeddings = isContentChanged || isMediaDeleted;

  // Extract hashtags
  const hashtagRegex = /#(\w+)/g;
  const hashtags: string[] = [];
  let match;
  while ((match = hashtagRegex.exec(content)) !== null) {
    hashtags.push(match[1].toLowerCase());
  }
  const uniqueHashtags = [...new Set(hashtags)];

  // Filter self tagging
  const taggedUserIdsFiltered = taggedUserIds.filter((id) => id !== user.id);

  const previousTaggedUserIds = post.post_tags.map((tag) => tag.userId);
  const idsToObjectTo = taggedUserIdsFiltered.filter(
    (id) => !previousTaggedUserIds.includes(id)
  ); // New tags
  const idsToRemove = previousTaggedUserIds.filter(
    (id) => !taggedUserIdsFiltered.includes(id)
  ); // Removed tags
  console.log("IDs to tag:", idsToObjectTo);
  console.log("IDs to remove from tags:", idsToRemove);

  // Apply DB update
  const updatedPost = await prisma.post.update({
    where: { id: input.postId },
    data: {
      content,
      privacy,
      mediaLayout,
      hashtags: uniqueHashtags,
      attachments: {
        deleteMany: {
          id: { in: mediaIdsToDelete },
        },
      },
      post_tags: {
        deleteMany: {
          userId: { in: idsToRemove },
        },
        create: idsToObjectTo.map((userId) => ({
          userId,
        })),
      },
    },
    include: {
      user: {
        select: {
          id: true,
          username: true,
          displayName: true,
          avatarUrl: true,
          createdAt: true,
          bio: true,
          interests: true,
          provinceCode: true,
          districtCode: true,
          countryCode: true,
          followers: true,
          blockedByUsers: true,
        },
      },
      attachments: true,
      post_tags: {
        include: {
          users: true,
        },
      },
      likes: {
        select: {
          userId: true,
        },
      },
      bookmarks: {
        select: {
          userId: true,
        },
      },
      _count: {
        select: {
          likes: true,
          comments: true,
        },
      },
    },
  });

  if (shouldRecalculateEmbeddings)
    void (async () => {
      try {
        const attachments = updatedPost.attachments ?? [];
        const imageUrl = attachments.find((m) => m.type === "IMAGE")?.url;
        const videoUrl = attachments.find((m) => m.type === "VIDEO")?.url;
        const [multimodalEmbedding, geminiAnalysis] = await Promise.all([
          getMultimodalEmbedding(content, imageUrl, videoUrl),
          analyzePostWithGemini(content, imageUrl, videoUrl),
        ]);

        const normalizedVector = normalizeVector(multimodalEmbedding);

        const topicEmbeddings = await Promise.all(
          geminiAnalysis.topics.map((topic) => getTextEmbedding(topic))
        );

        await prisma.$executeRawUnsafe(
          `
        UPDATE "posts"
        SET
          embedding = $1::vector,
          "topicEmbeddings" = $2::vector[],
          emotions = $3::"EMOTION",
          "emotionScore" = $4,
          "primaryEmotion" = $5,
          topics = $6::text[],
          harmful = $7,
          "harmfulTypes" = $8::text[],
          "wisdomOrAdviceMessage" = $9
        WHERE id = $10
      `,
          `[${normalizedVector.join(",")}]`,
          topicEmbeddings.map((emb) => `[${emb.join(",")}]`),
          geminiAnalysis.emotion,
          geminiAnalysis.sentimentScore,
          geminiAnalysis.primaryEmotion,
          geminiAnalysis.topics,
          geminiAnalysis.harmful,
          geminiAnalysis.harmfulTypes,
          geminiAnalysis.wisdomOrAdviceMessage,
          updatedPost.id
        );

        // Recalculate user emotion score
        const allUserPosts = await prisma.post.findMany({
          where: { userId: user.id },
          select: { emotionScore: true, harmful: true },
        });

        if (allUserPosts.length > 0) {
          const totalScore = allUserPosts.reduce(
            (sum, p) => sum + (p.emotionScore ?? 0.5),
            0
          );
          const avg = totalScore / allUserPosts.length;

          await prisma.user.update({
            where: { id: user.id },
            data: {
              generalEmotion:
                avg > 0.55 ? "POSITIVE" : avg < 0.45 ? "NEGATIVE" : "NEUTRAL",
              emotionScore: avg,
            },
          });
        }

        // await processMentions(content, user.id, updatedPost.id);
      } catch (err) {
        console.error("Error in background recalculation:", err);
      }
    })();

  if (idsToObjectTo.length > 0) {
    await Promise.all(
      idsToObjectTo.map((uid) =>
        sendNotification(uid, user.id, "TAG_REQUEST", updatedPost.id)
      )
    );
  }

  return updatedPost;
}
