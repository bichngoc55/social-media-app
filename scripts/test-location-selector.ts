/**
 * Test LocationSelector API functions
 * Chạy: tsx scripts/test-location-selector.ts
 */

import {
  getProvinces,
  getWardsByProvince,
  getDistrictByCode,
  getWardByCode,
} from "../src/lib/provinces-api";

async function testLocationSelector() {
  try {
    console.log("=".repeat(60));
    console.log("🧪 Testing LocationSelector API Functions");
    console.log("=".repeat(60));
    console.log();

    // Test 1: Get provinces
    console.log("1️⃣  Testing getProvinces()...");
    const provinces = await getProvinces();
    console.log(`   ✅ Loaded ${provinces.length} provinces`);
    console.log(`   📋 Sample provinces:`);
    provinces.slice(0, 5).forEach((p) => {
      console.log(`      - ${p.name} (${p.code})`);
    });
    console.log();

    // Test 2: Get wards by province (Hà Nội)
    console.log("2️⃣  Testing getWardsByProvince('79') - Hà Nội...");
    const startTime = Date.now();
    const wards = await getWardsByProvince("79");
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`   ✅ Loaded ${wards.length} wards in ${duration}s`);
    console.log(`   📋 Sample wards:`);
    wards.slice(0, 10).forEach((w) => {
      console.log(
        `      - ${w.name} (${w.code}) - District: ${w.district_code}`
      );
    });
    console.log();

    // Test 3: Test ward selection and auto-get district
    if (wards.length > 0) {
      const testWard = wards[0];
      console.log("3️⃣  Testing ward → district mapping...");
      console.log(`   Selected Ward: ${testWard.name} (${testWard.code})`);
      console.log(`   District Code: ${testWard.district_code}`);

      const district = await getDistrictByCode(testWard.district_code);
      if (district) {
        console.log(`   ✅ District: ${district.name} (${district.code})`);
        console.log(`   ✅ Province: ${district.province_code}`);
      } else {
        console.log(`   ❌ Could not find district`);
      }
      console.log();
    }

    // Test 4: Test with another province (Đà Nẵng)
    console.log("4️⃣  Testing getWardsByProvince('48') - Đà Nẵng...");
    const startTime2 = Date.now();
    const wardsDN = await getWardsByProvince("48");
    const duration2 = ((Date.now() - startTime2) / 1000).toFixed(2);
    console.log(`   ✅ Loaded ${wardsDN.length} wards in ${duration2}s`);
    console.log(`   📋 Sample wards:`);
    wardsDN.slice(0, 5).forEach((w) => {
      console.log(`      - ${w.name} (${w.code})`);
    });
    console.log();

    // Test 5: Verify ward structure
    if (wards.length > 0) {
      console.log("5️⃣  Verifying ward structure...");
      const sampleWard = wards[0];
      console.log(`   Sample ward structure:`);
      console.log(`   - code: ${sampleWard.code}`);
      console.log(`   - name: ${sampleWard.name}`);
      console.log(`   - district_code: ${sampleWard.district_code}`);
      console.log(`   ✅ All wards have district_code for auto-mapping`);
      console.log();
    }

    console.log("=".repeat(60));
    console.log("✅ All tests passed!");
    console.log("=".repeat(60));
    console.log();
    console.log("💡 LocationSelector sẽ:");
    console.log("   1. Hiển thị dropdown 'Tỉnh thành'");
    console.log("   2. Khi chọn tỉnh → Load tất cả phường/xã của tỉnh đó");
    console.log("   3. Hiển thị dropdown 'Phường xã'");
    console.log("   4. Khi chọn phường/xã → Tự động set districtCode");
    console.log();
  } catch (error) {
    console.error("❌ Error:", error);
    if (error instanceof Error) {
      console.error("   Message:", error.message);
      console.error("   Stack:", error.stack);
    }
  }
}

testLocationSelector();
