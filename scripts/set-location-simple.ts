/**
 * Set location cho user (Hà Nội - Ba Đình - Cống Vị)
 * Chạy: tsx scripts/set-location-simple.ts [userId]
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function setLocation(userId: string) {
  try {
    // Hà Nội - Quận Ba Đình - Phường Cống Vị
    const provinceCode = "79"; // Hà Nội
    const districtCode = "760"; // Ba Đình
    const wardCode = "26734"; // Cống Vị

    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        provinceCode: provinceCode,
        districtCode: districtCode,
        wardCode: wardCode,
      },
      select: {
        id: true,
        username: true,
        displayName: true,
        provinceCode: true,
        districtCode: true,
        wardCode: true,
      },
    });

    console.log("✅ Location đã được set!");
    console.log(`   User: ${user.displayName} (@${user.username})`);
    console.log(
      `   Location: ${user.provinceCode} / ${user.districtCode} / ${user.wardCode}`
    );
    console.log(`   (Hà Nội - Ba Đình - Cống Vị)`);
  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

const userId = process.argv[2] || "ywpvfmby5wj2ivvx";
setLocation(userId);
