"use server";

import { validateRequest } from "@/auth";
import prisma from "@/lib/prisma";
import streamServerClient from "@/lib/stream";
import { getUserDataSelect } from "@/lib/types";
import {
  getCountry,
  getProvinceName,
  getDistrictName,
} from "@/lib/location-data";
import {
  updateUserProfileSchema,
  UpdateUserProfileValues,
} from "@/lib/validation";

export async function updateUserProfile(values: UpdateUserProfileValues) {
  const validatedValues = updateUserProfileSchema.parse(values);

  const { user } = await validateRequest();

  if (!user) throw new Error("Unauthorized");

  // Convert IDs to names and ISO codes
  let countryIso2 = null;
  let provinceName = null;
  let districtName = null;

  if (validatedValues.countryCode) {
    const country = getCountry(validatedValues.countryCode);
    countryIso2 = country?.iso2 || null;

    if (validatedValues.provinceCode) {
      provinceName = getProvinceName(
        validatedValues.countryCode,
        validatedValues.provinceCode
      );

      if (validatedValues.districtCode) {
        districtName = getDistrictName(
          validatedValues.countryCode,
          validatedValues.provinceCode,
          validatedValues.districtCode
        );
      }
    }
  }

  const updatedUser = await prisma.$transaction(async (tx) => {
    const updatedUser = await tx.user.update({
      where: { id: user.id },
      data: {
        displayName: validatedValues.displayName,
        bio: validatedValues.bio,
        interests: validatedValues.interests,
        countryCode: countryIso2,
        provinceCode: provinceName,
        districtCode: districtName,
        wardCode: null,
      },
      select: getUserDataSelect(user.id),
    });
    await streamServerClient.partialUpdateUser({
      id: user.id,
      set: {
        name: validatedValues.displayName,
      },
    });
    return updatedUser;
  });

  return updatedUser;
}
