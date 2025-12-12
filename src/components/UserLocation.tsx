"use client";

import {
  getCountry,
  getProvinceName,
  getDistrictName,
} from "@/lib/location-data";
import { useMemo } from "react";

interface UserLocationProps {
  countryCode?: string | null;
  provinceCode?: string | null;
  districtCode?: string | null;
  className?: string;
}

export default function UserLocation({
  countryCode,
  provinceCode,
  districtCode,
  className,
}: UserLocationProps) {
  const location = useMemo(() => {
    const parts: string[] = [];

    // Now all codes are IDs, convert them to names for display
    if (countryCode) {
      if (districtCode && provinceCode) {
        const districtName = getDistrictName(
          countryCode,
          provinceCode,
          districtCode
        );
        if (districtName) {
          parts.push(districtName);
        }
      }

      if (provinceCode) {
        const provinceName = getProvinceName(countryCode, provinceCode);
        if (provinceName) {
          parts.push(provinceName);
        }
      }

      const country = getCountry(countryCode);
      if (country) {
        parts.push(country.name);
      }
    }

    return parts.length > 0 ? parts.join(", ") : null;
  }, [countryCode, provinceCode, districtCode]);

  if (!location) {
    return null;
  }

  return (
    <div className={`text-sm text-muted-foreground ${className}`}>
      {location}
    </div>
  );
}
