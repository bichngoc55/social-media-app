/**
 * Set location cho users để test location-based recommendation với River Moore
 * River Moore: province 15, wardCode 04750
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function setLocationForTest() {
  try {
    console.log("=".repeat(60));
    console.log("📍 Setting Location cho Users để Test với River Moore");
    console.log("=".repeat(60));
    console.log();

    // Lấy River Moore để xem location
    const rivermoore = await prisma.user.findUnique({
      where: { username: "rivermoore24" },
      select: {
        id: true,
        username: true,
        displayName: true,
        provinceCode: true,
        districtCode: true,
        wardCode: true,
      },
    });

    if (!rivermoore) {
      console.log("❌ Không tìm thấy River Moore");
      return;
    }

    console.log(`🎯 River Moore location:`);
    console.log(`   Province: ${rivermoore.provinceCode}`);
    console.log(`   District: ${rivermoore.districtCode || "N/A"}`);
    console.log(`   Ward: ${rivermoore.wardCode}`);
    console.log();

    // Lấy một số users có posts nhưng chưa có location hoặc location khác
    const users = await prisma.user.findMany({
      where: {
        NOT: { id: rivermoore.id },
        posts: { some: { privacy: "PUBLIC" } },
      },
      select: {
        id: true,
        username: true,
        displayName: true,
        provinceCode: true,
        districtCode: true,
        wardCode: true,
      },
      take: 5,
    });

    console.log(`📊 Found ${users.length} candidate users`);
    console.log();

    // Set location cho users:
    // - 2 users cùng wardCode và provinceCode (location bonus cao nhất)
    // - 1 user cùng provinceCode nhưng khác wardCode
    // - 2 users khác provinceCode (để so sánh)

    const provinceCode = rivermoore.provinceCode!;
    const wardCode = rivermoore.wardCode!;

    const locations = [
      {
        province: provinceCode,
        district: rivermoore.districtCode || "001", // Dùng district hiện tại hoặc default
        ward: wardCode,
        name: `Cùng province + ward (${provinceCode} / ${wardCode})`,
      },
      {
        province: provinceCode,
        district: rivermoore.districtCode || "001",
        ward: wardCode,
        name: `Cùng province + ward (${provinceCode} / ${wardCode})`,
      },
      {
        province: provinceCode,
        district: rivermoore.districtCode || "001",
        ward: "04751", // Khác wardCode
        name: `Cùng province, khác ward (${provinceCode} / 04751)`,
      },
      {
        province: "79", // Khác province
        district: "760",
        ward: "26734",
        name: "Khác province (79)",
      },
      {
        province: "48", // Khác province
        district: "490",
        ward: "20287",
        name: "Khác province (48)",
      },
    ];

    console.log("🔄 Setting locations...");
    console.log();

    for (let i = 0; i < Math.min(users.length, locations.length); i++) {
      const user = users[i];
      const location = locations[i];

      await prisma.user.update({
        where: { id: user.id },
        data: {
          provinceCode: location.province,
          districtCode: location.district,
          wardCode: location.ward,
        },
      });

      console.log(`✅ ${i + 1}. ${user.displayName} (@${user.username})`);
      console.log(`   ${location.name}`);
      console.log();
    }

    console.log("=".repeat(60));
    console.log(
      "✅ Đã set location cho",
      Math.min(users.length, locations.length),
      "users"
    );
    console.log("=".repeat(60));
    console.log();
    console.log("🧪 Bây giờ test AI recommendations:");
    console.log(`   tsx scripts/test-ai-with-location.ts ${rivermoore.id}`);
    console.log();
    console.log("💡 Kỳ vọng:");
    console.log(
      "   - Users cùng wardCode + provinceCode sẽ có similarity cao hơn"
    );
    console.log(
      "   - Location bonus sẽ được áp dụng (60% location, 40% content)"
    );
  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

setLocationForTest();
