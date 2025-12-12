"use server";

import { validateRequest } from "@/auth";
import prisma from "@/lib/prisma";
import { getTextEmbedding } from "@/lib/vertex";
import streamServerClient from "@/lib/stream";
import { getUserDataSelect } from "@/lib/types";
import {
  updateUserProfileSchema,
  UpdateUserProfileValues,
} from "@/lib/validation";

export async function updateUserProfile(values: UpdateUserProfileValues) {
  const validatedValues = updateUserProfileSchema.parse(values);

  const { user } = await validateRequest();

  if (!user) throw new Error("Unauthorized");

  // Store IDs directly - no conversion needed
  const updatedUser = await prisma.$transaction(async (tx) => {
    const updatedUser = await tx.user.update({
      where: { id: user.id },
      data: {
        displayName: validatedValues.displayName,
        bio: validatedValues.bio,
        interests: validatedValues.interests,
        countryCode: validatedValues.countryCode || null,
        provinceCode: validatedValues.provinceCode || null,
        districtCode: validatedValues.districtCode || null,
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

  // Regenerate topic embeddings if interests changed (non-blocking)
  if (validatedValues.interests && validatedValues.interests.length > 0) {
    Promise.all(
      validatedValues.interests.map((topic) => getTextEmbedding(topic))
    )
      .then((topicEmbeddings) => {
        prisma.$executeRaw`
        UPDATE users
        SET "topicEmbeddings" = ARRAY[${topicEmbeddings.map((emb) => `'[${emb.join(",")}]'::vector`).join(",")}]::vector[]
        WHERE id = ${user.id}
      `;
      })
      .catch(() => {});
  }

  return updatedUser;
}
