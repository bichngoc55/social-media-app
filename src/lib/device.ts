export interface DeviceInfo {
  deviceId: string;
  deviceName: string;
  userAgent: string;
  ipAddress?: string;
}

export function generateDeviceId(userAgent: string): string {
  // Tạo device ID ổn định từ các thông tin cốt lõi của user agent
  const crypto = require("crypto");

  // Extract các thông tin cốt lõi
  const browserMatch = userAgent.match(/(Chrome|Firefox|Safari|Edge)\/[\d.]+/);
  const osMatch = userAgent.match(/(Windows|Mac|Linux|Android|iOS)/);
  const archMatch = userAgent.match(/(x64|x86|ARM)/);

  // Tạo fingerprint ổn định
  const fingerprint = [
    browserMatch ? browserMatch[0] : "Unknown",
    osMatch ? osMatch[0] : "Unknown",
    archMatch ? archMatch[0] : "Unknown",
  ].join("-");

  console.log("Device fingerprint:", fingerprint);

  return crypto
    .createHash("sha256")
    .update(fingerprint)
    .digest("hex")
    .substring(0, 16);
}

// Fallback: Tạo device ID từ session (nếu có)
export function generateSessionDeviceId(): string {
  const crypto = require("crypto");
  const timestamp = Math.floor(Date.now() / (1000 * 60 * 60)); // Thay đổi mỗi giờ
  return crypto
    .createHash("sha256")
    .update(`session-${timestamp}`)
    .digest("hex")
    .substring(0, 16);
}

export function getDeviceName(userAgent: string): string {
  // Parse user agent để tạo tên device thân thiện
  if (userAgent.includes("Mobile")) {
    if (userAgent.includes("iPhone")) return "iPhone";
    if (userAgent.includes("Android")) return "Android Phone";
    return "Mobile Device";
  }

  if (userAgent.includes("Tablet")) {
    return "Tablet";
  }

  if (userAgent.includes("Windows")) {
    return "Windows PC";
  }

  if (userAgent.includes("Mac")) {
    return "Mac";
  }

  if (userAgent.includes("Linux")) {
    return "Linux PC";
  }

  return "Unknown Device";
}

// Hàm này dùng cho client-side
export function getDeviceInfo(): DeviceInfo {
  const userAgent =
    typeof window !== "undefined" ? navigator.userAgent : "Unknown";
  return {
    deviceId: generateDeviceId(userAgent),
    deviceName: getDeviceName(userAgent),
    userAgent,
    ipAddress: undefined, // Không thể lấy IP từ client-side
  };
}
