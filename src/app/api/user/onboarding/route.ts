import { validateRequest } from "@/auth";
import prisma from "@/lib/prisma";
import {
  getCountry,
  getProvinceName,
  getDistrictName,
} from "@/lib/location-data";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { user } = await validateRequest();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { interests, countryCode, provinceCode, districtCode } = body;

    if (!Array.isArray(interests) || interests.length < 3) {
      return NextResponse.json(
        { error: "Please select at least 3 interests" },
        { status: 400 }
      );
    }

    if (!countryCode) {
      return NextResponse.json(
        { error: "Country is required" },
        { status: 400 }
      );
    }

    const country = getCountry(countryCode);
    const countryIso2 = country?.iso2 || null;
    const provinceName = provinceCode
      ? getProvinceName(countryCode, provinceCode)
      : null;
    const districtName =
      provinceCode && districtCode
        ? getDistrictName(countryCode, provinceCode, districtCode)
        : null;

    await prisma.user.update({
      where: { id: user.id },
      data: {
        interests: interests,
        countryCode: countryIso2,
        provinceCode: provinceName,
        districtCode: districtName,
        wardCode: null,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in onboarding:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
