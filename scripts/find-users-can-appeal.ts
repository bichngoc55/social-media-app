import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function findUsersCanAppeal() {
  try {
    console.log(
      `\n🔍 Đang tìm các user có bài viết harmful=true và có thể kháng cáo (có AI Flag)...\n`
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
      `📝 Tổng số bài viết có harmful=true: ${harmfulPosts.length}\n`
    );

    if (harmfulPosts.length === 0) {
      console.log("✅ Không có bài viết nào có harmful=true.\n");
      return;
    }

    // Kiểm tra từng post xem có AI Flag không
    const postsWithAIFlags: Array<{
      post: (typeof harmfulPosts)[0];
      moderationCase: any;
      activeWarning?: any;
      existingAppeal?: any;
    }> = [];

    for (const post of harmfulPosts) {
      // Kiểm tra xem có ModerationCase (AI Flag) không
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
          harmfulTypes: true,
          confidence: true,
        },
      });

      if (moderationCase) {
        // Kiểm tra warning
        const activeWarning = await (prisma as any).userWarning.findFirst({
          where: {
            userId: post.userId,
            postId: post.id,
            deadline: {
              gte: new Date(), // Deadline is in the future
            },
          },
          select: {
            id: true,
            deadline: true,
            createdAt: true,
          },
        });

        // Kiểm tra appeal
        const existingAppeal = await prisma.appealUserReport.findFirst({
          where: {
            userId: post.userId,
            postId: post.id,
            status: {
              in: ["PENDING", "UNDER_REVIEW"],
            },
          },
          select: {
            id: true,
            status: true,
            createdAt: true,
          },
        });

        postsWithAIFlags.push({
          post,
          moderationCase,
          activeWarning: activeWarning || undefined,
          existingAppeal: existingAppeal || undefined,
        });
      }
    }

    console.log(`🚩 Số bài viết có AI Flag: ${postsWithAIFlags.length}\n`);

    if (postsWithAIFlags.length === 0) {
      console.log(
        "❌ Không có bài viết nào có AI Flag. Không thể kháng cáo.\n"
      );
      console.log(
        "💡 Lý do: Các post có harmful=true nhưng không có ModerationCase (AI Flag)"
      );
      console.log("   → Cần tạo ModerationCase để có thể cảnh báo/kháng cáo\n");
      return;
    }

    // Nhóm theo user
    const userPostsMap = new Map<string, typeof postsWithAIFlags>();

    for (const item of postsWithAIFlags) {
      const userId = item.post.userId;
      if (!userPostsMap.has(userId)) {
        userPostsMap.set(userId, []);
      }
      userPostsMap.get(userId)!.push(item);
    }

    console.log(`👥 Số user có thể kháng cáo: ${userPostsMap.size}\n`);
    console.log("=".repeat(100));

    // Hiển thị từng user
    let index = 1;
    for (const [userId, items] of userPostsMap.entries()) {
      const user = items[0].post.user;

      console.log(`\n${index}. ${user.displayName} (@${user.username})`);
      console.log(`   User ID: ${userId}`);
      console.log(`   🚩 Số bài viết có AI Flag: ${items.length}`);

      // Đếm theo status
      const statusCount = items.reduce(
        (acc, item) => {
          const status = item.moderationCase.status;
          acc[status] = (acc[status] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>
      );

      console.log(`   📊 Phân bố Status:`);
      Object.entries(statusCount).forEach(([status, count]) => {
        console.log(`      • ${status}: ${count}`);
      });

      // Đếm warnings và appeals
      const withWarnings = items.filter((item) => item.activeWarning).length;
      const withAppeals = items.filter((item) => item.existingAppeal).length;
      const canAppeal = items.filter((item) => !item.existingAppeal).length;

      console.log(`   ⚠️  Số bài viết có warning: ${withWarnings}`);
      console.log(`   📝 Số bài viết đã kháng cáo: ${withAppeals}`);
      console.log(`   ✅ Số bài viết có thể kháng cáo: ${canAppeal}`);

      // Hiển thị chi tiết các bài viết
      console.log(`\n   📋 Chi tiết các bài viết:`);
      for (let i = 0; i < Math.min(5, items.length); i++) {
        const item = items[i];
        const post = item.post;
        const case_ = item.moderationCase;

        const contentPreview = post.content
          ? post.content.substring(0, 60) +
            (post.content.length > 60 ? "..." : "")
          : "[No content]";

        console.log(`\n      ${i + 1}. Post ID: ${post.id}`);
        console.log(`         📅 ${post.createdAt.toLocaleString("vi-VN")}`);
        console.log(`         📝 Content: ${contentPreview}`);
        console.log(
          `         🏷️  Harmful Types: ${post.harmfulTypes.join(", ") || "N/A"}`
        );
        console.log(`         ✅ Có AI Flag: YES`);
        console.log(`            • Case ID: ${case_.id}`);
        console.log(`            • Severity: ${case_.severity}`);
        console.log(`            • Status: ${case_.status}`);
        console.log(
          `            • Confidence: ${case_.confidence ? (case_.confidence * 100).toFixed(1) + "%" : "N/A"}`
        );
        console.log(
          `            • AI Types: ${case_.harmfulTypes.join(", ") || "N/A"}`
        );

        if (item.activeWarning) {
          console.log(`         ⚠️  Có Warning: YES`);
          console.log(`            • Warning ID: ${item.activeWarning.id}`);
          console.log(
            `            • Deadline: ${new Date(item.activeWarning.deadline).toLocaleString("vi-VN")}`
          );
          const deadlinePassed =
            new Date(item.activeWarning.deadline) < new Date();
          console.log(
            `            • Status: ${deadlinePassed ? "❌ Đã hết hạn" : "✅ Còn hiệu lực"}`
          );
        } else {
          console.log(`         ⚠️  Có Warning: NO`);
        }

        if (item.existingAppeal) {
          console.log(`         📝 Đã kháng cáo: YES`);
          console.log(`            • Appeal ID: ${item.existingAppeal.id}`);
          console.log(`            • Status: ${item.existingAppeal.status}`);
          console.log(
            `            • Created: ${new Date(item.existingAppeal.createdAt).toLocaleString("vi-VN")}`
          );
        } else {
          console.log(`         📝 Đã kháng cáo: NO`);
          console.log(`            ✅ Có thể kháng cáo ngay`);
        }
      }

      if (items.length > 5) {
        console.log(`\n      ... và ${items.length - 5} bài viết khác`);
      }

      console.log("\n" + "-".repeat(100));
      index++;
    }

    // Tổng kết
    console.log("\n📊 Tổng kết:\n");
    console.log(
      `   • Tổng số bài viết có harmful=true: ${harmfulPosts.length}`
    );
    console.log(`   • Số bài viết có AI Flag: ${postsWithAIFlags.length}`);
    console.log(`   • Số user có thể kháng cáo: ${userPostsMap.size}`);
    console.log(
      `   • Tỷ lệ có AI Flag: ${((postsWithAIFlags.length / harmfulPosts.length) * 100).toFixed(2)}%`
    );

    // Thống kê
    const totalWithWarnings = postsWithAIFlags.filter(
      (item) => item.activeWarning
    ).length;
    const totalWithAppeals = postsWithAIFlags.filter(
      (item) => item.existingAppeal
    ).length;
    const totalCanAppeal = postsWithAIFlags.filter(
      (item) => !item.existingAppeal
    ).length;

    console.log(`\n   📈 Thống kê:`);
    console.log(`      • Bài viết có warning: ${totalWithWarnings}`);
    console.log(`      • Bài viết đã kháng cáo: ${totalWithAppeals}`);
    console.log(`      • Bài viết có thể kháng cáo: ${totalCanAppeal}`);

    // Top 5 user có nhiều AI flags nhất
    const topUsers = Array.from(userPostsMap.entries())
      .map(([userId, items]) => ({
        userId,
        user: items[0].post.user,
        count: items.length,
        canAppeal: items.filter((item) => !item.existingAppeal).length,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    console.log(`\n   🏆 Top 5 user có nhiều AI flags nhất:`);
    topUsers.forEach((item, idx) => {
      console.log(
        `      ${idx + 1}. ${item.user.displayName} (@${item.user.username}): ${item.count} flags (${item.canAppeal} có thể kháng cáo)`
      );
    });

    console.log("\n");
  } catch (error) {
    console.error("❌ Lỗi:", error);
  } finally {
    await prisma.$disconnect();
  }
}

findUsersCanAppeal();
