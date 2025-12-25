import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function checkAIFlags(username: string) {
  try {
    console.log(`\n🔍 Đang kiểm tra AI flags cho user: ${username}\n`);

    // Tìm user
    const user = await prisma.user.findUnique({
      where: { username },
      select: {
        id: true,
        username: true,
        displayName: true,
      },
    });

    if (!user) {
      console.log(`❌ Không tìm thấy user với username: ${username}`);
      return;
    }

    console.log(`✅ Tìm thấy user: ${user.displayName} (@${user.username})`);
    console.log(`   User ID: ${user.id}\n`);

    // Tìm tất cả bài viết của user
    const posts = await prisma.post.findMany({
      where: { userId: user.id },
      select: {
        id: true,
        content: true,
        createdAt: true,
        harmful: true,
        harmfulTypes: true,
      },
      orderBy: { createdAt: "desc" },
    });

    console.log(`📝 Tổng số bài viết: ${posts.length}\n`);

    // Tìm tất cả AI flags cho user này
    const aiFlags = await prisma.moderationCase.findMany({
      where: {
        userId: user.id,
        source: "AI",
      },
      include: {
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
      console.log("✅ User này không có bài viết nào bị AI flags.\n");
      return;
    }

    // Hiển thị chi tiết từng AI flag
    console.log("📋 Chi tiết các AI flags:\n");
    console.log("=".repeat(80));

    for (let i = 0; i < aiFlags.length; i++) {
      const flag = aiFlags[i];
      const post = flag.post;

      console.log(`\n${i + 1}. AI Flag ID: ${flag.id}`);
      console.log(`   📅 Ngày tạo: ${flag.createdAt.toLocaleString("vi-VN")}`);
      console.log(`   ⚠️  Severity: ${flag.severity}`);
      console.log(`   🎯 Policy Area: ${flag.policyAreaPredicted || "N/A"}`);
      console.log(
        `   📊 Confidence: ${flag.confidence ? (flag.confidence * 100).toFixed(1) + "%" : "N/A"}`
      );
      console.log(
        `   🏷️  Harmful Types: ${flag.harmfulTypes.join(", ") || "N/A"}`
      );
      console.log(`   🔧 Auto Action: ${flag.autoAction}`);
      console.log(`   📈 Priority Score: ${flag.priorityScore.toFixed(2)}`);
      console.log(`   📌 Status: ${flag.status}`);

      if (post) {
        console.log(`\n   📝 Bài viết:`);
        console.log(`      Post ID: ${post.id}`);
        console.log(
          `      Content: ${post.content?.substring(0, 100)}${post.content && post.content.length > 100 ? "..." : ""}`
        );
        console.log(`      Created: ${post.createdAt.toLocaleString("vi-VN")}`);
        console.log(`      Harmful: ${post.harmful ? "✅ Yes" : "❌ No"}`);
        console.log(
          `      Harmful Types: ${post.harmfulTypes.join(", ") || "N/A"}`
        );
      } else {
        console.log(`\n   ⚠️  Bài viết không tìm thấy (có thể đã bị xóa)`);
      }

      // Kiểm tra warning cho post này
      if (post) {
        const warning = await (prisma as any).userWarning.findFirst({
          where: {
            userId: user.id,
            postId: post.id,
          },
          select: {
            id: true,
            message: true,
            deadline: true,
            createdAt: true,
          },
        });

        if (warning) {
          console.log(`\n   ⚠️  Cảnh báo:`);
          console.log(`      Warning ID: ${warning.id}`);
          console.log(`      Message: ${warning.message.substring(0, 50)}...`);
          console.log(
            `      Deadline: ${warning.deadline ? new Date(warning.deadline).toLocaleString("vi-VN") : "N/A"}`
          );
          console.log(
            `      Created: ${new Date(warning.createdAt).toLocaleString("vi-VN")}`
          );
        }
      }

      console.log("\n" + "-".repeat(80));
    }

    // Tổng kết
    console.log("\n📊 Tổng kết:\n");
    console.log(`   • Tổng số bài viết: ${posts.length}`);
    console.log(`   • Số bài viết bị AI flags: ${aiFlags.length}`);
    console.log(
      `   • Tỷ lệ: ${((aiFlags.length / posts.length) * 100).toFixed(2)}%`
    );

    // Đếm theo severity
    const severityCount = aiFlags.reduce(
      (acc, flag) => {
        acc[flag.severity] = (acc[flag.severity] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    console.log(`\n   📊 Phân bố theo Severity:`);
    Object.entries(severityCount).forEach(([severity, count]) => {
      console.log(`      • ${severity}: ${count}`);
    });

    // Đếm theo status
    const statusCount = aiFlags.reduce(
      (acc, flag) => {
        acc[flag.status] = (acc[flag.status] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    console.log(`\n   📊 Phân bố theo Status:`);
    Object.entries(statusCount).forEach(([status, count]) => {
      console.log(`      • ${status}: ${count}`);
    });

    console.log("\n");
  } catch (error) {
    console.error("❌ Lỗi:", error);
  } finally {
    await prisma.$disconnect();
  }
}

// Lấy username từ command line argument
const username = process.argv[2] || "finn.king";

checkAIFlags(username);
