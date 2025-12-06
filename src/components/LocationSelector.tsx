"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getAllCountries,
  getProvinces,
  getDistricts,
} from "@/lib/location-data";
import { useMemo } from "react";

interface LocationSelectorProps {
  countryCode?: string | null;
  provinceCode?: string | null;
  districtCode?: string | null;
  onCountryChange: (code: string | null) => void;
  onProvinceChange: (code: string | null) => void;
  onDistrictChange: (code: string | null) => void;
  className?: string;
}

export default function LocationSelector({
  countryCode,
  provinceCode,
  districtCode,
  onCountryChange,
  onProvinceChange,
  onDistrictChange,
  className,
}: LocationSelectorProps) {
  const countries = useMemo(() => getAllCountries(), []);

  const provinces = useMemo(() => {
    if (!countryCode) return [];
    const country = countries.find((c) => c.id.toString() === countryCode);
    return country ? getProvinces(country.iso2) : [];
  }, [countryCode, countries]);

  const districts = useMemo(() => {
    if (!countryCode || !provinceCode) return [];
    const country = countries.find((c) => c.id.toString() === countryCode);
    const province = provinces.find((p) => p.id.toString() === provinceCode);

    if (country && province) {
      return getDistricts(country.iso2, province.iso2);
    }
    return [];
  }, [countryCode, provinceCode, countries, provinces]);

  const handleCountryChange = (value: string | null) => {
    onCountryChange(value);
    onProvinceChange(null);
    onDistrictChange(null);
  };

  const handleProvinceChange = (value: string | null) => {
    onProvinceChange(value);
    onDistrictChange(null);
  };

  return (
    <div className={`space-y-3 ${className || ""}`}>
      {/* Country Selector */}
      <div>
        <label className="mb-1.5 block text-sm font-medium">Country</label>
        <Select
          value={countryCode || undefined}
          onValueChange={handleCountryChange}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select country" />
          </SelectTrigger>
          <SelectContent>
            {countries.map((country) => (
              <SelectItem key={country.id} value={country.id.toString()}>
                {country.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Province Selector - Always Enabled */}
      <div>
        <label className="mb-1.5 block text-sm font-medium">
          Province/State (Optional)
        </label>
        <Select
          value={provinceCode || undefined}
          onValueChange={handleProvinceChange}
          // disabled prop removed
        >
          <SelectTrigger>
            <SelectValue placeholder="Select province/state" />
          </SelectTrigger>
          <SelectContent>
            {provinces.length > 0 ? (
              provinces.map((province) => (
                <SelectItem key={province.id} value={province.id.toString()}>
                  {province.name}
                </SelectItem>
              ))
            ) : (
              <div className="p-2 text-center text-sm text-muted-foreground">
                Select a country first
              </div>
            )}
          </SelectContent>
        </Select>
      </div>

      {/* District Selector - Always Enabled */}
      <div>
        <label className="mb-1.5 block text-sm font-medium">
          District/City (Optional)
        </label>
        <Select
          value={districtCode || undefined}
          onValueChange={(value) => onDistrictChange(value || null)}
          // disabled prop removed
        >
          <SelectTrigger>
            <SelectValue placeholder="Select district/city" />
          </SelectTrigger>
          <SelectContent>
            {districts.length > 0 ? (
              districts.map((district) => (
                <SelectItem key={district.id} value={district.id.toString()}>
                  {district.name}
                </SelectItem>
              ))
            ) : (
              <div className="p-2 text-center text-sm text-muted-foreground">
                Select a province first
              </div>
            )}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
