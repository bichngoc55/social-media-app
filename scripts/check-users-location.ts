/**
 * Kiểm tra users có location data
 * Chạy: tsx scripts/check-users-location.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function checkUsersLocation() {
  try {
    console.log("=".repeat(60));
    console.log("🔍 Checking Users with Location Data");
    console.log("=".repeat(60));
    console.log();

    const users = await prisma.user.findMany({
      where: {
        provinceCode: { not: null },
      },
      select: {
        id: true,
        username: true,
        displayName: true,
        provinceCode: true,
        districtCode: true,
        wardCode: true,
      },
      take: 20,
    });

    console.log(`📊 Found ${users.length} users with location:`);
    console.log();

    // Group by province
    const byProvince = new Map<string, typeof users>();
    users.forEach((u) => {
      const key = u.provinceCode || "N/A";
      if (!byProvince.has(key)) {
        byProvince.set(key, []);
      }
      byProvince.get(key)!.push(u);
    });

    byProvince.forEach((usersInProvince, provinceCode) => {
      console.log(
        `📍 Province ${provinceCode}: ${usersInProvince.length} users`
      );
      usersInProvince.forEach((u) => {
        console.log(
          `   - ${u.username} (${u.displayName}): ${u.provinceCode} / ${u.districtCode || "N/A"} / ${u.wardCode || "N/A"}`
        );
      });
      console.log();
    });

    // Check for users with same province
    const rivermoore = users.find((u) => u.username === "rivermoore24");
    if (rivermoore) {
      console.log(
        `🎯 River Moore location: ${rivermoore.provinceCode} / ${rivermoore.districtCode || "N/A"} / ${rivermoore.wardCode || "N/A"}`
      );
      const sameProvince = users.filter(
        (u) =>
          u.id !== rivermoore.id && u.provinceCode === rivermoore.provinceCode
      );
      console.log(`   Users cùng tỉnh: ${sameProvince.length}`);

      if (rivermoore.wardCode) {
        const sameWard = users.filter(
          (u) =>
            u.id !== rivermoore.id &&
            u.provinceCode === rivermoore.provinceCode &&
            u.wardCode === rivermoore.wardCode
        );
        console.log(`   Users cùng phường: ${sameWard.length}`);
      }
    }

    console.log("=".repeat(60));
  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

checkUsersLocation();
