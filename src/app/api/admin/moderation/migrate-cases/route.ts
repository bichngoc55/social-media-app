import { requireAdmin } from "@/lib/admin";
import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { createModerationCaseFromAI } from "@/lib/moderation";

/**
 * API endpoint to migrate existing harmful posts to ModerationCase
 * This creates ModerationCase for posts that were flagged as harmful
 * but don't have a corresponding ModerationCase yet
 */
export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin();

    // Find all posts that are marked as harmful
    const allHarmfulPosts = await prisma.post.findMany({
      where: {
        harmful: true,
        harmfulTypes: {
          isEmpty: false,
        },
      },
      select: {
        id: true,
        userId: true,
        harmful: true,
        harmfulTypes: true,
      },
      take: 1000, // Get all harmful posts first
    });

    // Get existing moderation cases for these posts
    // Use raw query to check if cases exist (works even if Prisma client not generated)
    let existingPostIds = new Set<string>();
    try {
      if (allHarmfulPosts.length > 0) {
        const postIds = allHarmfulPosts.map((p) => p.id);
        const existingCasesRaw = await prisma.$queryRawUnsafe<
          Array<{ postId: string | null }>
        >(
          `SELECT "postId" FROM moderation_cases 
           WHERE "postId" = ANY($1::text[])
           AND source = 'AI'
           AND "postId" IS NOT NULL`,
          postIds
        );
        existingPostIds = new Set(
          existingCasesRaw.map((c) => c.postId).filter(Boolean) as string[]
        );
      }
    } catch (error) {
      console.error("Error checking existing cases:", error);
      // Continue without filtering if query fails (table might not exist yet)
    }

    // Filter out posts that already have cases
    const harmfulPosts = allHarmfulPosts.filter(
      (p) => !existingPostIds.has(p.id)
    );

    // Get engagement counts for remaining posts
    const postsWithEngagement = await Promise.all(
      harmfulPosts.map(async (post) => {
        const [likesCount, commentsCount] = await Promise.all([
          prisma.like.count({ where: { postId: post.id } }),
          prisma.comment.count({ where: { postId: post.id } }),
        ]);

        return {
          ...post,
          _count: {
            likes: likesCount,
            comments: commentsCount,
          },
        };
      })
    );

    if (postsWithEngagement.length === 0) {
      return NextResponse.json({
        message: "No posts need migration",
        migrated: 0,
        total: allHarmfulPosts.length,
        alreadyHaveCases: existingPostIds.size,
      });
    }

    const results = {
      success: 0,
      failed: 0,
      errors: [] as string[],
    };

    // Create ModerationCase for each post
    for (const post of postsWithEngagement) {
      try {
        if (!post.harmfulTypes || post.harmfulTypes.length === 0) {
          continue;
        }

        // Calculate engagement
        const postEngagement = {
          likes: post._count.likes,
          comments: post._count.comments,
          shares: 0, // Posts don't have shares count in current schema
        };

        // Create moderation case
        await createModerationCaseFromAI({
          postId: post.id,
          userId: post.userId,
          harmful: post.harmful,
          harmfulTypes: post.harmfulTypes,
          confidence: 0.8, // Default confidence for migrated posts
          postEngagement,
        });

        results.success++;
      } catch (error) {
        results.failed++;
        results.errors.push(
          `Post ${post.id}: ${error instanceof Error ? error.message : "Unknown error"}`
        );
        console.error(`Error migrating post ${post.id}:`, error);
      }
    }

    return NextResponse.json({
      message: `Migration completed`,
      total: allHarmfulPosts.length,
      alreadyHaveCases: existingPostIds.size,
      needsMigration: postsWithEngagement.length,
      ...results,
    });
  } catch (error) {
    console.error("Error migrating moderation cases:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}
