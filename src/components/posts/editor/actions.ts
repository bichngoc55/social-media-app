"use server";

import { validateRequest } from "@/auth";
import { createModerationCaseFromAI } from "@/lib/moderation";
import prisma from "@/lib/prisma";
import { processMentions } from "@/lib/socket";
import { getPostDataInclude } from "@/lib/types";
import { createPostSchema } from "@/lib/validation";
import {
  analyzePostWithGemini,
  getMultimodalEmbedding,
  getTextEmbedding,
  normalizeVector,
} from "@/lib/vertex";

export async function submitPost(input: {
  content: string;
  mediaIds: string[];
  privacy: "DRAFT" | "FOLLOWERS" | "PUBLIC";
  mediaLayout?: "GRID" | "CAROUSEL" | "COLUMNS" | "FRAME";
  taggedUserIds?: string[];
  isAnalyzed?: boolean;
}) {
  const { user } = await validateRequest();

  if (!user) throw new Error("Unauthorized");
  console.log("Submitting post for user ID:", user.id);

  const { isAnalyzed = true, ...postData } = input;
  console.log("🚀 ~ submitPost ~ isAnalyzed:", isAnalyzed);

  const parsed = createPostSchema.parse(postData);
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
  console.log("Created new post with ID:", newPost.id);
  let analysis: {
    sentimentScore: number;
    emotion: string;
    primaryEmotion: string;
    topics: string[];
    wisdomOrAdviceMessage: string;
    harmful: boolean;
    harmfulTypes: string[];
    flags?: string[];
  } = {
    sentimentScore: 0.5,
    emotion: "NEUTRAL",
    primaryEmotion: "neutral",
    topics: [],
    wisdomOrAdviceMessage: "",
    harmful: false,
    harmfulTypes: [],
    flags: [],
  };

  // Process post analysis, embeddings, and notifications in background (non-blocking)
  Promise.all([
    isAnalyzed
      ? (async () => {
          try {
            const imageUrl = newPost.attachments.find(
              (m) => m.type === "IMAGE"
            )?.url;
            const videoUrl = newPost.attachments.find(
              (m) => m.type === "VIDEO"
            )?.url;

            // Generate both embeddings and analysis in parallel
            const [multimodalEmbedding, geminiAnalysis] = await Promise.all([
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
            console.log(
              "Gemini analysis for post ID",
              newPost.id,
              ":",
              geminiAnalysis
            );

            analysis = geminiAnalysis;
            const normalizedMultimodalVector =
              normalizeVector(multimodalEmbedding);

            // Generate embeddings for each topic
            const topicEmbeddings = await Promise.all(
              analysis.topics.map((topic) => getTextEmbedding(topic))
            );

            // Format embeddings for PostgreSQL vector type
            const embeddingString = `[${normalizedMultimodalVector.join(",")}]`;
            const topicEmbeddingsArray = topicEmbeddings.map(
              (emb) => `[${emb.join(",")}]`
            );
            try {
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
                embeddingString,
                topicEmbeddingsArray,
                analysis.emotion,
                analysis.sentimentScore,
                analysis.primaryEmotion,
                analysis.topics,
                analysis.harmful,
                analysis.harmfulTypes,
                analysis.wisdomOrAdviceMessage,
                newPost.id
              );
            } catch (error) {
              console.error("Error updating post with analysis data:", error);
            }

            // Create moderation case if AI detected harmful content
            if (analysis.harmful && analysis.harmfulTypes.length > 0) {
              try {
                const postEngagement = { likes: 0, comments: 0, shares: 0 }; // New post has no engagement yet
                await createModerationCaseFromAI({
                  postId: newPost.id,
                  userId: user.id,
                  harmful: analysis.harmful,
                  harmfulTypes: analysis.harmfulTypes,
                  confidence: 0.8, // Default confidence, could be improved with actual model confidence
                  postEngagement,
                });
              } catch (error) {
                console.error("Error creating moderation case:", error);
                // Don't fail post creation if moderation case creation fails
              }
            }

            // Use AI analysis score directly from Gemini (already ranges 0.1-0.4 for harmful)
            const newEmotionScore = analysis.sentimentScore;

            await prisma.user.update({
              where: { id: user.id },
              data: {
                generalEmotion:
                  newEmotionScore > 0.55
                    ? "POSITIVE"
                    : newEmotionScore < 0.45
                      ? "NEGATIVE"
                      : "NEUTRAL",
                emotionScore: newEmotionScore,
              },
            });
          } catch (error) {}
        })()
      : Promise.resolve(),
    taggedUserIdsFiltered.length > 0
      ? Promise.all(
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
        )
      : Promise.resolve(),
    processMentions(content, user.id, newPost.id),
  ]).catch(() => {});

  return newPost;
}
