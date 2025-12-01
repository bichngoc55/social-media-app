"use client";

import {
  getDistrictByCode,
  getProvinceByCode,
  getWardByCode,
} from "@/lib/provinces-api";
import { useEffect, useState } from "react";

interface UserLocationProps {
  provinceCode?: string | null;
  districtCode?: string | null;
  wardCode?: string | null;
  className?: string;
}

export default function UserLocation({
  provinceCode,
  districtCode,
  wardCode,
  className,
}: UserLocationProps) {
  const [location, setLocation] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadLocation() {
      if (!provinceCode) {
        setLocation(null);
        setLoading(false);
        return;
      }

      try {
        const parts: string[] = [];

        if (wardCode && provinceCode) {
          const ward = await getWardByCode(
            String(wardCode),
            String(provinceCode)
          );
          if (ward) {
            parts.push(ward.name);
          } else {
            console.warn(
              `Ward not found: wardCode=${wardCode}, provinceCode=${provinceCode}`
            );
          }
        }

        // District name không có trong API 34tinhthanh.com, skip
        // if (districtCode) {
        //   const district = await getDistrictByCode(districtCode);
        //   if (district) parts.push(district.name);
        // }

        if (provinceCode) {
          const province = await getProvinceByCode(String(provinceCode));
          if (province) {
            parts.push(province.name);
          } else {
            console.warn(`Province not found: provinceCode=${provinceCode}`);
          }
        }

        setLocation(parts.length > 0 ? parts.join(", ") : null);
      } catch (error) {
        console.error("Error loading location:", error);
        setLocation(null);
      } finally {
        setLoading(false);
      }
    }

    loadLocation();
  }, [provinceCode, districtCode, wardCode]);

  if (loading) {
    return (
      <div className={`text-sm text-muted-foreground ${className}`}>
        Loading location...
      </div>
    );
  }

  if (!location) {
    return null;
  }

  return (
    <div className={`text-sm text-muted-foreground ${className}`}>
      📍 {location}
    </div>
  );
}
