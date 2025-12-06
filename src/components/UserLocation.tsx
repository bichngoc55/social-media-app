"use client";

import { getCountryByIso2 } from "@/lib/location-data";
import { useMemo } from "react";

interface UserLocationProps {
  countryCode?: string | null;
  provinceCode?: string | null;
  districtCode?: string | null;
  wardCode?: string | null;
  className?: string;
}

export default function UserLocation({
  countryCode,
  provinceCode,
  districtCode,
  wardCode,
  className,
}: UserLocationProps) {
  const location = useMemo(() => {
    const parts: string[] = [];

    if (districtCode) {
      parts.push(districtCode);
    }

    if (provinceCode) {
      parts.push(provinceCode);
    }

    if (countryCode) {
      const country = getCountryByIso2(countryCode);
      if (country) {
        parts.push(country.name);
      }
    }

    return parts.length > 0 ? parts.join(", ") : null;
  }, [countryCode, provinceCode, districtCode, wardCode]);

  if (!location) {
    return null;
  }

  return (
    <div className={`text-sm text-muted-foreground ${className}`}>
      {location}
    </div>
  );
}
