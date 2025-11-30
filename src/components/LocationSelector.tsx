"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getProvinces,
  getWardsByProvince,
  getDistrictByCode,
  type Province,
  type Ward,
} from "@/lib/provinces-api";
import { useEffect, useState } from "react";

interface LocationSelectorProps {
  provinceCode?: string | null;
  districtCode?: string | null;
  wardCode?: string | null;
  onProvinceChange: (code: string | null) => void;
  onDistrictChange: (code: string | null) => void;
  onWardChange: (code: string | null) => void;
  className?: string;
}

export default function LocationSelector({
  provinceCode,
  districtCode,
  wardCode,
  onProvinceChange,
  onDistrictChange,
  onWardChange,
  className,
}: LocationSelectorProps) {
  const [provinces, setProvinces] = useState<Province[]>([]);
  const [wards, setWards] = useState<Ward[]>([]);
  const [loading, setLoading] = useState({
    provinces: true,
    wards: false,
  });
  const [error, setError] = useState<string | null>(null);

  // Get current ward code as string for Select component
  const currentWardCode = wardCode ? String(wardCode) : "";

  // Load provinces
  useEffect(() => {
    getProvinces()
      .then((data) => {
        setProvinces(data);
        setLoading((prev) => ({ ...prev, provinces: false }));
        setError(null);
      })
      .catch((error) => {
        console.error("Error loading provinces:", error);
        setLoading((prev) => ({ ...prev, provinces: false }));
        setError("Không thể tải danh sách tỉnh thành. Vui lòng thử lại.");
      });
  }, []);

  // Load wards when province changes or when component mounts with provinceCode
  useEffect(() => {
    if (provinceCode) {
      setLoading((prev) => ({ ...prev, wards: true }));
      getWardsByProvince(provinceCode)
        .then((data) => {
          console.log(
            `Loaded ${data.length} wards for province ${provinceCode}`,
            data.slice(0, 3)
          );
          setWards(data);
          setLoading((prev) => ({ ...prev, wards: false }));
          // Reset ward only if current ward doesn't belong to new province
          const currentWardCode = wardCode;
          if (currentWardCode) {
            const currentWard = data.find(
              (w) => String(w.code) === String(currentWardCode)
            );
            if (!currentWard) {
              // Ward không thuộc province mới, reset
              console.log(
                `Ward ${currentWardCode} not found in new province, resetting`
              );
              onWardChange(null);
              onDistrictChange(null);
            } else {
              console.log(
                `Ward ${currentWardCode} found in province ${provinceCode}:`,
                currentWard.name
              );
            }
          }
        })
        .catch((error) => {
          console.error("Error loading wards:", error);
          setLoading((prev) => ({ ...prev, wards: false }));
        });
    } else {
      setWards([]);
      // Reset ward when province is cleared
      if (wardCode) {
        onWardChange(null);
        onDistrictChange(null);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provinceCode]); // Chỉ depend on provinceCode để tránh infinite loop

  // Also load wards when wardCode is set but wards haven't been loaded yet
  useEffect(() => {
    if (provinceCode && wardCode && wards.length === 0 && !loading.wards) {
      console.log("Loading wards because wardCode is set but wards are empty");
      setLoading((prev) => ({ ...prev, wards: true }));
      getWardsByProvince(provinceCode)
        .then((data) => {
          console.log(
            `Loaded ${data.length} wards for province ${provinceCode} (triggered by wardCode)`
          );
          setWards(data);
          setLoading((prev) => ({ ...prev, wards: false }));
        })
        .catch((error) => {
          console.error("Error loading wards:", error);
          setLoading((prev) => ({ ...prev, wards: false }));
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wardCode, provinceCode]); // Load when wardCode or provinceCode changes

  // Auto-set districtCode when ward is selected
  useEffect(() => {
    if (wardCode && !districtCode) {
      const selectedWard = wards.find(
        (w) => String(w.code) === String(wardCode)
      );
      if (selectedWard) {
        onDistrictChange(selectedWard.district_code);
      }
    }
  }, [wardCode, wards, districtCode, onDistrictChange]);

  return (
    <div className={`space-y-3 ${className}`}>
      <div>
        <label className="text-sm font-medium">Tỉnh thành</label>
        {error && <p className="mb-2 text-sm text-destructive">{error}</p>}
        <Select
          value={provinceCode ? String(provinceCode) : ""}
          onValueChange={(value) => onProvinceChange(value || null)}
          disabled={loading.provinces}
        >
          <SelectTrigger>
            <SelectValue
              placeholder={
                loading.provinces ? "Đang tải..." : "Chọn tỉnh/thành phố"
              }
            />
          </SelectTrigger>
          <SelectContent>
            {provinces.length === 0 && !loading.provinces ? (
              <div className="px-2 py-1.5 text-sm text-muted-foreground">
                Không có dữ liệu
              </div>
            ) : (
              provinces.map((province) => (
                <SelectItem key={province.code} value={province.code}>
                  {province.name}
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
      </div>

      {provinceCode && (
        <div>
          <label className="text-sm font-medium">Phường xã (tùy chọn)</label>
          <Select
            value={currentWardCode}
            onValueChange={(value) => {
              // Handle special "none" value to clear selection
              if (value === "__none__") {
                onWardChange(null);
              } else {
                onWardChange(value || null);
              }
            }}
            disabled={loading.wards || !provinceCode}
          >
            <SelectTrigger>
              <SelectValue
                placeholder={
                  loading.wards
                    ? "Đang tải..."
                    : wards.length === 0
                      ? "Không có dữ liệu"
                      : "Chọn phường/xã"
                }
              />
            </SelectTrigger>
            <SelectContent>
              {loading.wards ? (
                <div className="px-2 py-1.5 text-sm text-muted-foreground">
                  Đang tải...
                </div>
              ) : wards.length === 0 ? (
                <div className="px-2 py-1.5 text-sm text-muted-foreground">
                  Không có dữ liệu
                </div>
              ) : (
                <>
                  <SelectItem value="__none__">Không chọn</SelectItem>
                  {wards.map((ward, index) => {
                    const wardCodeStr = String(ward.code);
                    const uniqueKey = `${provinceCode}-${wardCodeStr}-${index}`;
                    return (
                      <SelectItem key={uniqueKey} value={wardCodeStr}>
                        {ward.name || `Ward ${wardCodeStr}`}
                      </SelectItem>
                    );
                  })}
                </>
              )}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}
