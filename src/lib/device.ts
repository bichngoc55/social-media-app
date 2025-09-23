import { headers } from "next/headers";

export interface DeviceInfo {
  deviceId: string;
  deviceName: string;
  userAgent: string;
  ipAddress?: string;
}

export function generateDeviceId(userAgent: string, ipAddress?: string): string {
  // Tạo device ID từ user agent và IP
  const crypto = require('crypto');
  const input = `${userAgent}-${ipAddress || 'unknown'}`;
  return crypto.createHash('sha256').update(input).digest('hex').substring(0, 16);
}

export function getDeviceName(userAgent: string): string {
  // Parse user agent để tạo tên device thân thiện
  if (userAgent.includes('Mobile')) {
    if (userAgent.includes('iPhone')) return 'iPhone';
    if (userAgent.includes('Android')) return 'Android Phone';
    return 'Mobile Device';
  }
  
  if (userAgent.includes('Tablet')) {
    return 'Tablet';
  }
  
  if (userAgent.includes('Windows')) {
    return 'Windows PC';
  }
  
  if (userAgent.includes('Mac')) {
    return 'Mac';
  }
  
  if (userAgent.includes('Linux')) {
    return 'Linux PC';
  }
  
  return 'Unknown Device';
}

export async function getDeviceInfo(): Promise<DeviceInfo> {
  const headersList = await headers();
  const userAgent = headersList.get('user-agent') || 'Unknown';
  const ipAddress = headersList.get('x-forwarded-for') || 
                   headersList.get('x-real-ip') || 
                   'unknown';
  
  return {
    deviceId: generateDeviceId(userAgent, ipAddress),
    deviceName: getDeviceName(userAgent),
    userAgent,
    ipAddress: ipAddress === 'unknown' ? undefined : ipAddress,
  };
}
