/**
 * Set location cho nhiều users để test location matching
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function setMultipleUsersLocation() {
  try {
    console.log("📍 Setting location cho nhiều users...");
    console.log();

    // Lấy một số users có posts
    const users = await prisma.user.findMany({
      where: {
        posts: { some: { privacy: "PUBLIC" } },
      },
      select: {
        id: true,
        username: true,
        displayName: true,
      },
      take: 10,
    });

    console.log(`📊 Found ${users.length} users`);
    console.log();

    // Set location cho users
    // User 1: Hà Nội - Ba Đình - Cống Vị (đã set)
    // User 2-3: Cùng Hà Nội - Ba Đình nhưng khác phường
    // User 4-5: Cùng Hà Nội nhưng khác quận
    // User 6-7: Khác tỉnh

    const locations = [
      {
        province: "79",
        district: "760",
        ward: "26734",
        name: "Hà Nội - Ba Đình - Cống Vị",
      }, // User 1
      {
        province: "79",
        district: "760",
        ward: "26735",
        name: "Hà Nội - Ba Đình - Điện Biên",
      }, // User 2
      {
        province: "79",
        district: "760",
        ward: "26736",
        name: "Hà Nội - Ba Đình - Đội Cấn",
      }, // User 3
      {
        province: "79",
        district: "761",
        ward: "26764",
        name: "Hà Nội - Hoàn Kiếm - Chương Dương",
      }, // User 4
      {
        province: "79",
        district: "761",
        ward: "26765",
        name: "Hà Nội - Hoàn Kiếm - Cửa Đông",
      }, // User 5
      {
        province: "48",
        district: "490",
        ward: "20287",
        name: "Đà Nẵng - Hải Châu - Hải Châu 1",
      }, // User 6
      {
        province: "48",
        district: "490",
        ward: "20288",
        name: "Đà Nẵng - Hải Châu - Hải Châu 2",
      }, // User 7
    ];

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
      console.log(`   Location: ${location.name}`);
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
    console.log(`   tsx scripts/test-ai-with-location.ts ${users[0].id}`);
  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

setMultipleUsersLocation();
