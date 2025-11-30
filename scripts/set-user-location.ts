/**
 * Set location cho user để test AI recommendations với location
 * Chạy: tsx scripts/set-user-location.ts [userId] [provinceCode] [districtCode] [wardCode]
 *
 * Ví dụ: tsx scripts/set-user-location.ts ywpvfmby5wj2ivvx 79 760 26734
 * (Hà Nội - Quận Ba Đình - Phường Cống Vị)
 */

import { PrismaClient } from "@prisma/client";
import {
  getProvinces,
  getDistrictsByProvince,
  getWardsByDistrict,
} from "../src/lib/provinces-api";

const prisma = new PrismaClient();

async function setUserLocation(
  userId: string,
  provinceCode?: string,
  districtCode?: string,
  wardCode?: string
) {
  try {
    console.log("=".repeat(60));
    console.log("📍 Setting User Location");
    console.log("=".repeat(60));
    console.log();

    // Lấy user
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        displayName: true,
        provinceCode: true,
        districtCode: true,
        wardCode: true,
      },
    });

    if (!user) {
      console.log(`❌ Không tìm thấy user với ID: ${userId}`);
      return;
    }

    console.log(`👤 User: ${user.displayName} (@${user.username})`);
    console.log(
      `   Current Location: ${user.provinceCode || "N/A"} / ${user.districtCode || "N/A"} / ${user.wardCode || "N/A"}`
    );
    console.log();

    // Nếu không có codes, hiển thị danh sách để chọn
    if (!provinceCode) {
      console.log("📋 Danh sách tỉnh/thành phố phổ biến:");
      const provinces = await getProvinces();

      // Hiển thị một số tỉnh phổ biến
      const popularProvinces = [
        "79", // Hà Nội
        "48", // Đà Nẵng
        "01", // Hồ Chí Minh
        "31", // Hải Phòng
        "92", // Cần Thơ
      ];

      const popular = provinces.filter((p) =>
        popularProvinces.includes(p.code)
      );
      popular.forEach((p) => {
        console.log(`   ${p.code}: ${p.name}`);
      });
      console.log();
      console.log("💡 Để set location, chạy:");
      console.log(
        `   tsx scripts/set-user-location.ts ${userId} <provinceCode> [districtCode] [wardCode]`
      );
      console.log();
      console.log("📝 Ví dụ (Hà Nội - Ba Đình - Cống Vị):");
      console.log(`   tsx scripts/set-user-location.ts ${userId} 79 760 26734`);
      return;
    }

    // Validate province
    const provinces = await getProvinces();
    const province = provinces.find((p) => p.code === provinceCode);
    if (!province) {
      console.log(`❌ Không tìm thấy tỉnh với code: ${provinceCode}`);
      return;
    }

    console.log(`✅ Tỉnh/Thành phố: ${province.name}`);

    let finalDistrictCode: string | null = null;
    let finalWardCode: string | null = null;

    // Validate district nếu có
    if (districtCode) {
      const districts = await getDistrictsByProvince(provinceCode);
      const district = districts.find((d) => d.code === districtCode);
      if (!district) {
        console.log(`❌ Không tìm thấy quận/huyện với code: ${districtCode}`);
        return;
      }
      console.log(`✅ Quận/Huyện: ${district.name}`);
      finalDistrictCode = districtCode;

      // Validate ward nếu có
      if (wardCode) {
        const wards = await getWardsByDistrict(districtCode);
        const ward = wards.find((w) => w.code === wardCode);
        if (!ward) {
          console.log(`❌ Không tìm thấy phường/xã với code: ${wardCode}`);
          return;
        }
        console.log(`✅ Phường/Xã: ${ward.name}`);
        finalWardCode = wardCode;
      }
    }

    console.log();

    // Update user location
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        provinceCode: provinceCode,
        districtCode: finalDistrictCode,
        wardCode: finalWardCode,
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

    console.log("✅ Location đã được cập nhật!");
    console.log(
      `   User: ${updatedUser.displayName} (@${updatedUser.username})`
    );
    console.log(
      `   Location: ${updatedUser.provinceCode || "N/A"} / ${updatedUser.districtCode || "N/A"} / ${updatedUser.wardCode || "N/A"}`
    );
    console.log();
    console.log("🧪 Bây giờ bạn có thể test AI recommendations với location:");
    console.log(`   tsx scripts/test-ai-with-location.ts ${userId}`);

    console.log("=".repeat(60));
  } catch (error) {
    console.error("❌ Error:", error);
    if (error instanceof Error) {
      console.error("   Message:", error.message);
    }
  } finally {
    await prisma.$disconnect();
  }
}

// Lấy arguments từ command line
const userId = process.argv[2];
const provinceCode = process.argv[3];
const districtCode = process.argv[4];
const wardCode = process.argv[5];

if (!userId) {
  console.log("❌ Vui lòng cung cấp User ID");
  console.log(
    "   Usage: tsx scripts/set-user-location.ts <userId> [provinceCode] [districtCode] [wardCode]"
  );
  process.exit(1);
}

setUserLocation(userId, provinceCode, districtCode, wardCode);
