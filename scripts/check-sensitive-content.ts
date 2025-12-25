import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function checkSensitiveContent() {
  try {
    console.log(
      `\n🔍 Đang kiểm tra các bài viết có Sensitive Content (harmful = true)...\n`
    );

    // Tìm tất cả post có harmful = true
    const harmfulPosts = await prisma.post.findMany({
      where: {
        harmful: true,
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            displayName: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    console.log(
      `🚩 Tổng số bài viết có Sensitive Content: ${harmfulPosts.length}\n`
    );

    if (harmfulPosts.length === 0) {
      console.log("✅ Không có bài viết nào có Sensitive Content.\n");
      return;
    }

    // Nhóm theo user
    const userPostsMap = new Map<string, typeof harmfulPosts>();

    for (const post of harmfulPosts) {
      if (!userPostsMap.has(post.userId)) {
        userPostsMap.set(post.userId, []);
      }
      userPostsMap.get(post.userId)!.push(post);
    }

    console.log(
      `👥 Số user có bài viết Sensitive Content: ${userPostsMap.size}\n`
    );
    console.log("=".repeat(100));

    // Kiểm tra xem có ModerationCase (AI flags) không
    let postsWithAIFlags = 0;
    let postsWithoutAIFlags = 0;

    // Hiển thị từng user
    let index = 1;
    for (const [userId, posts] of userPostsMap.entries()) {
      const user = posts[0].user;

      console.log(`\n${index}. ${user.displayName} (@${user.username})`);
      console.log(`   User ID: ${userId}`);
      console.log(`   🚩 Số bài viết Sensitive Content: ${posts.length}`);

      // Đếm harmful types
      const harmfulTypesCount = new Map<string, number>();
      for (const post of posts) {
        for (const type of post.harmfulTypes) {
          harmfulTypesCount.set(type, (harmfulTypesCount.get(type) || 0) + 1);
        }
      }

      if (harmfulTypesCount.size > 0) {
        console.log(`   🏷️  Harmful Types:`);
        Array.from(harmfulTypesCount.entries())
          .sort((a, b) => b[1] - a[1])
          .forEach(([type, count]) => {
            console.log(`      • ${type}: ${count}`);
          });
      }

      // Kiểm tra AI flags (ModerationCase) cho từng post
      console.log(`\n   📋 Chi tiết các bài viết:`);
      for (let i = 0; i < Math.min(5, posts.length); i++) {
        const post = posts[i];

        // Kiểm tra xem có ModerationCase không
        const moderationCase = await prisma.moderationCase.findFirst({
          where: {
            postId: post.id,
            source: "AI",
          },
          select: {
            id: true,
            severity: true,
            status: true,
            createdAt: true,
          },
        });

        const hasAIFlag = !!moderationCase;
        if (hasAIFlag) {
          postsWithAIFlags++;
        } else {
          postsWithoutAIFlags++;
        }

        const contentPreview = post.content
          ? post.content.substring(0, 60) +
            (post.content.length > 60 ? "..." : "")
          : "[No content]";

        console.log(`\n      ${i + 1}. Post ID: ${post.id}`);
        console.log(`         📅 ${post.createdAt.toLocaleString("vi-VN")}`);
        console.log(`         📝 Content: ${contentPreview}`);
        console.log(
          `         🏷️  Types: ${post.harmfulTypes.join(", ") || "N/A"}`
        );
        console.log(
          `         ${hasAIFlag ? "✅" : "❌"} AI Flag: ${hasAIFlag ? "CÓ" : "KHÔNG"}`
        );

        if (hasAIFlag && moderationCase) {
          console.log(`            • Case ID: ${moderationCase.id}`);
          console.log(`            • Severity: ${moderationCase.severity}`);
          console.log(`            • Status: ${moderationCase.status}`);
          console.log(
            `            • Created: ${moderationCase.createdAt.toLocaleString("vi-VN")}`
          );
        } else {
          console.log(
            `            ⚠️  Post có harmful=true nhưng KHÔNG có ModerationCase (AI Flag)`
          );
          console.log(`            💡 Điều này có nghĩa là:`);
          console.log(`               - Post bị AI phát hiện harmful khi tạo`);
          console.log(
            `               - Nhưng không tạo ModerationCase (có thể do logic chưa chạy hoặc bị skip)`
          );
        }
      }

      if (posts.length > 5) {
        console.log(`\n      ... và ${posts.length - 5} bài viết khác`);
      }

      console.log("\n" + "-".repeat(100));
      index++;
    }

    // Tổng kết
    console.log("\n📊 Tổng kết:\n");
    console.log(
      `   • Tổng số bài viết có Sensitive Content (harmful=true): ${harmfulPosts.length}`
    );
    console.log(
      `   • Số user có bài viết Sensitive Content: ${userPostsMap.size}`
    );
    console.log(
      `   • Bài viết có AI Flag (ModerationCase): ${postsWithAIFlags}`
    );
    console.log(`   • Bài viết KHÔNG có AI Flag: ${postsWithoutAIFlags}`);
    console.log(
      `   • Tỷ lệ có AI Flag: ${((postsWithAIFlags / harmfulPosts.length) * 100).toFixed(2)}%`
    );

    // Giải thích sự khác biệt
    console.log(`\n📖 Giải thích:\n`);
    console.log(`   🔴 Sensitive Content (harmful = true):`);
    console.log(`      - Post bị AI phát hiện là harmful khi tạo`);
    console.log(
      `      - Post sẽ bị blur và hiển thị warning "Sensitive Content"`
    );
    console.log(`      - User phải click để xem nội dung`);
    console.log(`\n   🚩 AI Flags (ModerationCase với source = "AI"):`);
    console.log(
      `      - Case được tạo trong hệ thống moderation để admin review`
    );
    console.log(
      `      - Admin có thể quyết định: CONFIRM, RESTORE, DISMISS, etc.`
    );
    console.log(
      `      - Chỉ các post có AI Flag mới có thể bị cảnh báo/kháng cáo`
    );
    console.log(`\n   ⚠️  Lưu ý:`);
    console.log(
      `      - Không phải tất cả post có harmful=true đều có AI Flag`
    );
    console.log(
      `      - AI Flag chỉ được tạo khi hàm createModerationCaseFromAI() được gọi`
    );
    console.log(
      `      - Có thể một số post bị harmful=true nhưng không tạo case (do logic skip)`
    );

    console.log("\n");
  } catch (error) {
    console.error("❌ Lỗi:", error);
  } finally {
    await prisma.$disconnect();
  }
}

checkSensitiveContent();
