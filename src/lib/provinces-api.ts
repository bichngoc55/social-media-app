/**
 * Client để gọi Vietnam Provinces API
 * Sử dụng 34tinhthanh.com API (provinces.open-api.vn đã bị tạm dừng)
 * Gọi trực tiếp từ client (API hỗ trợ CORS)
 */

const PROVINCES_API_URL = "https://34tinhthanh.com/api";

export interface Province {
  code: string;
  name: string;
  name_en: string;
  full_name: string;
  full_name_en: string;
  code_name: string;
}

export interface District {
  code: string;
  name: string;
  name_en: string;
  full_name: string;
  full_name_en: string;
  code_name: string;
  province_code: string;
}

export interface Ward {
  code: string;
  name: string;
  name_en: string;
  full_name: string;
  full_name_en: string;
  code_name: string;
  district_code: string;
}

/**
 * Lấy danh sách tất cả tỉnh/thành phố
 */
export async function getProvinces(): Promise<Province[]> {
  const response = await fetch(`${PROVINCES_API_URL}/provinces`);
  if (!response.ok) {
    throw new Error("Failed to fetch provinces");
  }
  const data = await response.json();
  // API trả về { province_code, name }, cần map sang { code, name, ... }
  if (!Array.isArray(data)) return [];
  return data.map((item: any) => ({
    code: String(item.province_code || item.code || ""),
    name: item.name || "",
    name_en: item.name_en || "",
    full_name: item.full_name || item.name || "",
    full_name_en: item.full_name_en || "",
    code_name: item.code_name || "",
  }));
}

/**
 * Lấy danh sách quận/huyện theo mã tỉnh
 * Note: 34tinhthanh.com không có endpoint districts, chỉ có wards
 */
export async function getDistrictsByProvince(
  provinceCode: string
): Promise<District[]> {
  // Lấy tất cả wards, rồi extract unique districts
  const wards = await getWardsByProvince(provinceCode);
  const districtMap = new Map<string, District>();

  wards.forEach((ward) => {
    if (ward.district_code && !districtMap.has(ward.district_code)) {
      // Tạo district từ ward data
      districtMap.set(ward.district_code, {
        code: ward.district_code,
        name: "", // Sẽ cần lookup sau
        name_en: "",
        full_name: "",
        full_name_en: "",
        code_name: "",
        province_code: provinceCode,
      });
    }
  });

  return Array.from(districtMap.values());
}

/**
 * Lấy danh sách phường/xã theo mã quận/huyện
 * Note: 34tinhthanh.com không có endpoint theo district, cần filter từ wards của province
 */
export async function getWardsByDistrict(
  districtCode: string
): Promise<Ward[]> {
  // Cần provinceCode để lấy wards, nhưng không có trong params
  // Tạm thời return empty, hoặc cần refactor để pass provinceCode
  return [];
}

/**
 * Lấy tất cả phường/xã của một tỉnh/thành phố
 */
export async function getWardsByProvince(
  provinceCode: string
): Promise<Ward[]> {
  const response = await fetch(
    `${PROVINCES_API_URL}/wards?province_code=${provinceCode}`
  );
  if (!response.ok) {
    throw new Error("Failed to fetch wards");
  }
  const data = await response.json();
  if (!Array.isArray(data)) return [];
  // API trả về { ward_code, ward_name, province_code, ... }, cần map sang { code, name, district_code, ... }
  // Note: API không có district_code, cần extract từ ward_code hoặc dùng empty string
  const mappedWards = data.map((item: any) => ({
    code: String(item.ward_code || item.code || ""),
    name: item.ward_name || item.name || "",
    name_en: item.name_en || "",
    full_name: item.full_name || item.ward_name || "",
    full_name_en: item.full_name_en || "",
    code_name: item.code_name || "",
    district_code: item.district_code || "", // API không có, để empty
  }));

  // Remove duplicates by code (keep first occurrence)
  const uniqueWards = Array.from(
    new Map(mappedWards.map((ward) => [ward.code, ward])).values()
  );

  return uniqueWards;
}

/**
 * Lấy thông tin tỉnh theo code
 */
export async function getProvinceByCode(
  code: string
): Promise<Province | null> {
  try {
    const provinces = await getProvinces();
    const province = provinces.find((p) => p.code === code);
    return province || null;
  } catch {
    return null;
  }
}

/**
 * Lấy thông tin quận/huyện theo code
 * Note: Cần provinceCode để lookup, nhưng API không hỗ trợ lookup trực tiếp
 */
export async function getDistrictByCode(
  code: string
): Promise<District | null> {
  // Không có endpoint lookup, cần search từ wards
  // Tạm thời return null, hoặc cần refactor
  return null;
}

/**
 * Lấy thông tin phường/xã theo code
 * Note: Cần provinceCode để lookup
 */
export async function getWardByCode(
  code: string,
  provinceCode?: string
): Promise<Ward | null> {
  try {
    if (!provinceCode) {
      // Nếu không có provinceCode, cần search từ tất cả provinces (chậm)
      return null;
    }
    const wards = await getWardsByProvince(String(provinceCode));
    const codeStr = String(code);
    const ward = wards.find((w) => String(w.code) === codeStr);
    return ward || null;
  } catch (error) {
    console.error("Error in getWardByCode:", error);
    return null;
  }
}

/**
 * Lấy địa chỉ đầy đủ từ các mã
 */
export async function getFullAddress(
  provinceCode?: string | null,
  districtCode?: string | null,
  wardCode?: string | null
): Promise<string | null> {
  if (!provinceCode) return null;

  const parts: string[] = [];

  if (wardCode) {
    const ward = await getWardByCode(wardCode, provinceCode);
    if (ward) parts.push(ward.name);
  }

  // District name không có trong API, skip
  // if (districtCode) {
  //   const district = await getDistrictByCode(districtCode);
  //   if (district) parts.push(district.name);
  // }

  const province = await getProvinceByCode(provinceCode);
  if (province) parts.push(province.name);

  return parts.length > 0 ? parts.join(", ") : null;
}
