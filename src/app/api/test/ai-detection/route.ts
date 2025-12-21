import { NextRequest, NextResponse } from "next/server";
import { analyzePostWithGemini } from "@/lib/vertex";
import { createModerationCaseFromAI } from "@/lib/moderation";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

/**
 * Test endpoint để kiểm tra AI detection
 * POST /api/test/ai-detection
 * Body: { content: string }
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { content } = await req.json();

    if (!content) {
      return NextResponse.json(
        { error: "Content is required" },
        { status: 400 }
      );
    }

    // 1. Test AI Analysis
    console.log("🔍 Testing AI analysis...");
    const analysis = await analyzePostWithGemini(content);
    console.log("✅ AI Analysis result:", {
      harmful: analysis.harmful,
      harmfulTypes: analysis.harmfulTypes,
      confidence: "N/A (using default 0.8)",
    });

    // 2. Tạo test post
    console.log("📝 Creating test post...");
    const testPost = await prisma.post.create({
      data: {
        content,
        userId: session.user.id,
        privacy: "PUBLIC",
        harmful: analysis.harmful,
        harmfulTypes: analysis.harmfulTypes,
      },
    });
    console.log("✅ Test post created:", testPost.id);

    // 3. Update post với full analysis data
    await prisma.$executeRawUnsafe(
      `
      UPDATE "posts"
      SET 
        harmful = $1,
        "harmfulTypes" = $2::text[]
      WHERE id = $3
    `,
      analysis.harmful,
      analysis.harmfulTypes,
      testPost.id
    );

    // 4. Tạo ModerationCase nếu harmful
    let moderationCase = null;
    if (analysis.harmful && analysis.harmfulTypes.length > 0) {
      console.log("🛡️ Creating moderation case...");
      try {
        moderationCase = await createModerationCaseFromAI({
          postId: testPost.id,
          userId: session.user.id,
          harmful: analysis.harmful,
          harmfulTypes: analysis.harmfulTypes,
          confidence: 0.8,
          postEngagement: { likes: 0, comments: 0, shares: 0 },
        });
        console.log("✅ Moderation case created:", moderationCase?.id);
      } catch (error) {
        console.error("❌ Error creating moderation case:", error);
      }
    }

    // 5. Verify data
    const verification = {
      post: {
        id: testPost.id,
        harmful: analysis.harmful,
        harmfulTypes: analysis.harmfulTypes,
      },
      moderationCase: moderationCase
        ? {
            id: moderationCase.id,
            status: moderationCase.status,
            severity: moderationCase.severity,
            priorityScore: moderationCase.priorityScore,
          }
        : null,
      auditLogs: moderationCase
        ? await prisma.moderationAuditLog.findMany({
            where: { caseId: moderationCase.id },
            select: {
              id: true,
              action: true,
              reason: true,
              createdAt: true,
            },
          })
        : [],
    };

    return NextResponse.json({
      success: true,
      message: "Test completed",
      analysis: {
        harmful: analysis.harmful,
        harmfulTypes: analysis.harmfulTypes,
        emotion: analysis.emotion,
        sentimentScore: analysis.sentimentScore,
      },
      verification,
      nextSteps: [
        "1. Check database: SELECT * FROM posts WHERE id = $1",
        "2. Check moderation_cases: SELECT * FROM moderation_cases WHERE postId = $1",
        "3. Check audit logs: SELECT * FROM moderation_audit_logs WHERE caseId = $1",
        "4. Go to /admin/posts → Tab B (AI Flags) to see the case",
      ],
    });
  } catch (error) {
    console.error("❌ Test error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}

/**
 * GET endpoint để xem test results
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get recent test posts
    const testPosts = await prisma.post.findMany({
      where: {
        userId: session.user.id,
        harmful: true,
      },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        content: true,
        harmful: true,
        harmfulTypes: true,
        createdAt: true,
        moderationCases: {
          select: {
            id: true,
            status: true,
            severity: true,
            priorityScore: true,
            createdAt: true,
          },
        },
      },
    });

    return NextResponse.json({
      testPosts,
      instructions: [
        "POST to /api/test/ai-detection with { content: 'test harmful content' }",
        "Or create a post in the UI with harmful content",
      ],
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
