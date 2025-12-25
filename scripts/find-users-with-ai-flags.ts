import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function findUsersWithAIFlags() {
  try {
    console.log(`\n🔍 Đang tìm tất cả user có bài viết bị AI flags...\n`);

    // Tìm tất cả AI flags
    const aiFlags = await prisma.moderationCase.findMany({
      where: {
        source: "AI",
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
          },
        },
        post: {
          select: {
            id: true,
            content: true,
            createdAt: true,
            harmful: true,
            harmfulTypes: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    console.log(`🚩 Tổng số AI flags: ${aiFlags.length}\n`);

    if (aiFlags.length === 0) {
      console.log("✅ Không có user nào có bài viết bị AI flags.\n");
      return;
    }

    // Nhóm theo user
    const userFlagsMap = new Map<string, typeof aiFlags>();

    for (const flag of aiFlags) {
      if (!flag.userId || !flag.user) continue;

      if (!userFlagsMap.has(flag.userId)) {
        userFlagsMap.set(flag.userId, []);
      }
      userFlagsMap.get(flag.userId)!.push(flag);
    }

    console.log(`👥 Tổng số user có AI flags: ${userFlagsMap.size}\n`);
    console.log("=".repeat(100));

    // Hiển thị từng user
    let index = 1;
    for (const [userId, flags] of userFlagsMap.entries()) {
      const user = flags[0].user!;

      console.log(`\n${index}. ${user.displayName} (@${user.username})`);
      console.log(`   User ID: ${userId}`);
      console.log(`   🚩 Số lượng AI flags: ${flags.length}`);

      // Đếm theo severity
      const severityCount = flags.reduce(
        (acc, flag) => {
          acc[flag.severity] = (acc[flag.severity] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>
      );

      console.log(`   📊 Phân bố Severity:`);
      Object.entries(severityCount).forEach(([severity, count]) => {
        console.log(`      • ${severity}: ${count}`);
      });

      // Đếm theo status
      const statusCount = flags.reduce(
        (acc, flag) => {
          acc[flag.status] = (acc[flag.status] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>
      );

      console.log(`   📊 Phân bố Status:`);
      Object.entries(statusCount).forEach(([status, count]) => {
        console.log(`      • ${status}: ${count}`);
      });

      // Kiểm tra warnings
      const warnings = await (prisma as any).userWarning.findMany({
        where: {
          userId: userId,
          postId: { not: null },
        },
        select: {
          id: true,
          postId: true,
          deadline: true,
          createdAt: true,
        },
      });

      console.log(`   ⚠️  Số lượng warnings: ${warnings.length}`);

      if (warnings.length > 0) {
        const activeWarnings = warnings.filter(
          (w: any) => w.deadline && new Date(w.deadline) > new Date()
        );
        console.log(`      • Active warnings: ${activeWarnings.length}`);
      }

      // Hiển thị 3 AI flags gần nhất
      console.log(`\n   📋 3 AI flags gần nhất:`);
      for (let i = 0; i < Math.min(3, flags.length); i++) {
        const flag = flags[i];
        const post = flag.post;

        console.log(`\n      ${i + 1}. Flag ID: ${flag.id}`);
        console.log(`         📅 ${flag.createdAt.toLocaleString("vi-VN")}`);
        console.log(`         ⚠️  Severity: ${flag.severity}`);
        console.log(
          `         📊 Confidence: ${flag.confidence ? (flag.confidence * 100).toFixed(1) + "%" : "N/A"}`
        );
        console.log(
          `         🏷️  Types: ${flag.harmfulTypes.join(", ") || "N/A"}`
        );
        console.log(`         📌 Status: ${flag.status}`);

        if (post) {
          const contentPreview = post.content
            ? post.content.substring(0, 60) +
              (post.content.length > 60 ? "..." : "")
            : "[No content]";
          console.log(`         📝 Post: ${contentPreview}`);
        }
      }

      console.log("\n" + "-".repeat(100));
      index++;
    }

    // Tổng kết
    console.log("\n📊 Tổng kết:\n");
    console.log(`   • Tổng số AI flags: ${aiFlags.length}`);
    console.log(`   • Số user có AI flags: ${userFlagsMap.size}`);
    console.log(
      `   • Trung bình flags/user: ${(aiFlags.length / userFlagsMap.size).toFixed(2)}`
    );

    // Top 5 user có nhiều flags nhất
    const topUsers = Array.from(userFlagsMap.entries())
      .map(([userId, flags]) => ({
        userId,
        user: flags[0].user!,
        count: flags.length,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    console.log(`\n   🏆 Top 5 user có nhiều AI flags nhất:`);
    topUsers.forEach((item, idx) => {
      console.log(
        `      ${idx + 1}. ${item.user.displayName} (@${item.user.username}): ${item.count} flags`
      );
    });

    console.log("\n");
  } catch (error) {
    console.error("❌ Lỗi:", error);
  } finally {
    await prisma.$disconnect();
  }
}

findUsersWithAIFlags();
