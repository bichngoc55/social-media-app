import locationData from "@/../countries+states+cities.json";

export interface City {
  id: number;
  name: string;
  latitude: string;
  longitude: string;
  timezone: string;
}

export interface State {
  id: number;
  name: string;
  iso2: string;
  iso3166_2?: string;
  native: string;
  latitude: string;
  longitude: string;
  type: string;
  timezone: string;
  cities: City[];
}

export interface Country {
  id: number;
  name: string;
  iso3: string;
  iso2: string;
  native: string;
  states: State[];
}

export function getAllCountries(): Country[] {
  return locationData as Country[];
}

export function getCountry(countryId: string): Country | undefined {
  return locationData.find((country) => country.id.toString() === countryId) as
    | Country
    | undefined;
}

export function getCountryByIso2(iso2: string): Country | undefined {
  return locationData.find((country) => country.iso2 === iso2) as
    | Country
    | undefined;
}

export function getProvinces(countryId: string): State[] {
  const country = getCountry(countryId);
  return country?.states || [];
}

export function getDistricts(countryId: string, provinceId: string): City[] {
  const provinces = getProvinces(countryId);
  const province = provinces.find((p) => p.id.toString() === provinceId);
  return province?.cities || [];
}

export function getCountryName(countryId: string): string {
  const country = getCountry(countryId);
  return country?.name || "";
}

export function getProvinceName(countryId: string, provinceId: string): string {
  const provinces = getProvinces(countryId);
  return provinces.find((p) => p.id.toString() === provinceId)?.name || "";
}

export function getDistrictName(
  countryId: string,
  provinceId: string,
  districtId: string
): string {
  const districts = getDistricts(countryId, provinceId);
  return districts.find((d) => d.id.toString() === districtId)?.name || "";
}
